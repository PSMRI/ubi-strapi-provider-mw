import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import { StrapiAdminProviderDto } from './dto/strapi-admin-provider.dto';
import { permissionsConfig } from './permissions.config';
import { StrapiAdminUserDto } from './dto/strapi-admin-user.dto';
import { FieldSubject, StrapiRegisterResponse, StrapiUserResponse } from './interfaces';
import { convertPropertiesToFields, getAuthToken } from 'src/common/util';

@Injectable()
export class StrapiAdminService {
  private readonly strapiUrl: string;
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.strapiUrl = this.configService.get<string>('STRAPI_URL') ?? '';
  }

  onModuleInit() {
    if (
      !this.strapiUrl.trim().length
    ) {
      throw new InternalServerErrorException(
        'One or more required environment variables are missing or empty: STRAPI_URL',
      );
    }
  }

  async getRoles(req: Request): Promise<any> {
    try {
      const authToken = getAuthToken(req);
      const roles = await this.getCatalogRoles(authToken);
      return roles;
    } catch (error) {
      console.error('Error fetching roles:', error.message);
      if (error.isAxiosError) {
        throw new HttpException(
          error.response?.data ?? 'Failed to fetch roles',
          error.response?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        error.message ?? 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createRole(strapiAdminProviderDto: StrapiAdminProviderDto, req: Request): Promise<any> {
    const authToken = getAuthToken(req);

    // Create a new role in Strapi, add it to Provider in Database and add permissions to it
    try {
      const role = await this.addRole(
        strapiAdminProviderDto.name,
        strapiAdminProviderDto.description,
        authToken,
      );

      const roleData = await this.createProviderInDatabase(role);

      if (!roleData) {
        throw new HttpException(
          'Failed to create role in the database',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const fields = await this.getFields(authToken);

      const permissions = await this.addPermissionToRole(role.id, authToken, fields);

      return {
        ...roleData,
        permissions
      };
    } catch (error) {
      console.error('Error creating role:', error.message);
      if (error.isAxiosError) {
        throw new HttpException(
          error.response?.data ?? 'Role creation failed',
          error.response?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        error.message ?? 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addRole(name: string, description: string, authToken: string): Promise<any> {
    const rolesEndpoint = `${this.strapiUrl}/admin/roles`;

    const response = await this.httpService.axiosRef.post(
      rolesEndpoint,
      {
        name: name,
        description: description,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'authorization': `${authToken}`,
        },
      },
    );

    const responseData = response?.data?.data;
    if (!responseData) {
      throw new HttpException(
        'Failed to create role in Strapi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return responseData;
  }

  mapFieldsForPermissions(fields: FieldSubject[]) {
    const benefitSubject: FieldSubject | undefined = fields.find(
      (field) => field.uid === 'api::benefit.benefit');

    if (!benefitSubject) {
      throw new HttpException(
        'Benefit properties not found in fields',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const mappedFields = convertPropertiesToFields(benefitSubject.properties);

    return mappedFields;
  }

  async getFields(authToken: string): Promise<any> {
    const fieldsEndpoint = `${this.strapiUrl}/admin/permissions?role=`;

    const response = await this.httpService.axiosRef.get(
      fieldsEndpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'authorization': `${authToken}`,
        },
      },
    );

    const responseData = response?.data?.data;
    if (!responseData) {
      throw new HttpException(
        'Failed to fetch fields from Strapi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.mapFieldsForPermissions(responseData.sections.collectionTypes.subjects);
  }

  async addPermissionToRole(roleId: string, authToken: string, fields: object): Promise<any> {
    const permissionsEndpoint = `${this.strapiUrl}/admin/roles/${roleId}/permissions`;

    const permissionsData = permissionsConfig.map((p) => {
      if (p.action !== 'plugin::content-manager.explorer.publish') {
        return {
          ...p,
          properties: fields,
        };
      }
      return p;
    })

    const response = await this.httpService.axiosRef.put(
      permissionsEndpoint,
      { permissions: permissionsData },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'authorization': `${authToken}`,
        },
      },
    );

    const permissionData = response?.data?.data;

    if (!permissionData) {
      throw new HttpException(
        'Failed to add permissions to the role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const permissions = permissionData.map((permission: any) => `${permission.action}`);

    return permissions;
  }

  async createProviderInDatabase(responseData: any): Promise<any> {
    // Create a new provider in the database
    return await this.prisma.provider.create({
      data: {
        catalogManagerId: `${responseData.id}`,
        catalogManagerDocumentId: responseData.documentId,
        name: responseData.name,
        description: responseData.description,
        catalogManagerRole: [responseData.name],
        catalogManagerCode: responseData.code,
        locale: responseData.locale,
        publishedAt: responseData.publishedAt,
      }
    })
  }

  async createUser(strapiAdminUserDto: StrapiAdminUserDto, req: Request): Promise<any> {
    try {
      const authToken = getAuthToken(req);
      const addedUser = await this.addUserToRole(strapiAdminUserDto, authToken);
      if (!addedUser) {
        throw new HttpException(
          'Failed to create user in Strapi',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await this.registerUser({
        firstname: strapiAdminUserDto.firstname,
        lastname: strapiAdminUserDto.lastname,
        password: strapiAdminUserDto.password,
        registrationToken: addedUser.registrationToken,
      });

      const userData = await this.createUserInDatabase({
        id: addedUser.id,
        email: addedUser.email,
        firstname: addedUser.firstname,
        lastname: addedUser.lastname,
        roles: addedUser.roles,
      });

      return userData;
    } catch (error) {
      console.error('Error creating user:', error.message);
      if (error.isAxiosError) {
        throw new HttpException(
          error.response?.data ?? 'User creation failed',
          error.response?.status ?? HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        error.message ?? 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addUserToRole(strapiAdminUserDto: StrapiAdminUserDto, authToken: string): Promise<StrapiUserResponse> {
    const usersEndpoint = `${this.strapiUrl}/admin/users`;

    const response = await this.httpService.axiosRef.post(
      usersEndpoint,
      {
        firstname: strapiAdminUserDto.firstname,
        lastname: strapiAdminUserDto.lastname,
        email: strapiAdminUserDto.email,
        roles: strapiAdminUserDto.roles,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'authorization': authToken,
        },
      },
    );

    const responseData = response?.data?.data;
    if (!responseData) {
      throw new HttpException(
        'Failed to create user in Strapi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return responseData;
  }

  async registerUser({ firstname, lastname, password, registrationToken }: { firstname: string; lastname: string; password: string; registrationToken: string }): Promise<StrapiRegisterResponse> {

    const registerEndpoint = `${this.strapiUrl}/admin/register`;

    const response = await this.httpService.axiosRef.post(
      registerEndpoint,
      {
        "userInfo": {
          firstname: firstname,
          lastname: lastname,
          password: password,
        },
        "registrationToken": registrationToken
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const responseData = response?.data?.data;
    if (!responseData) {
      throw new HttpException(
        'Failed to register user in Strapi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return responseData;
  }

  async getCatalogRoles(authToken: string): Promise<any> {
    const rolesEndpoint = `${this.strapiUrl}/admin/roles`;
    const response = await this.httpService.axiosRef.get(
      rolesEndpoint,
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'authorization': `${authToken}`,
        },
      },
    );

    const responseData = response?.data?.data;
    if (!responseData) {
      throw new HttpException(
        'Failed to fetch roles from Strapi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return responseData;
  }

  private async createUserInDatabase(responseData: any): Promise<any> {
    return await this.prisma.users.create({
      data: {
        s_id: `${responseData.id}`,
        email: responseData.email,
        first_name: responseData.firstname,
        last_name: responseData.lastname,
        enabled: true,
        s_roles: responseData.roles.map((role: any) => role.name),
      },
    });
  }
}