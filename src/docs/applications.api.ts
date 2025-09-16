export const ApplicationsApiDocs = {
  create: {
    operation: {
      summary: 'Create a new application',
      description: 'Create a new application with the provided data.',
    },
    body: {
      description: 'Application data',
      schema: {
        example: {
          benefitId: "BENEFIT123",
          firstName: "John",
          lastName: "Doe",
          age: "25",
          gender: "male",
          vc_documents: [
            {
              document_submission_reason: "[\"gender\"]",
              document_type: "idProof",
              document_subtype: "otrCertificate",
              document_format: "json",
              document_imported_from: "QR Code",
              document_content: "base64,ewogICJpZCI6IDEyMywKICAibmFtZSI6ICJKb2huIERvZSIsCiAgImVtYWlsIjogImpvaG5AZXhhbXBsZS5jb20iLAogICJhY3RpdmUiOiB0cnVlCn0="
            }
          ]
        }
      }
    },
    responses: {
      success: {
        status: 201,
        description: 'Application created successfully',
        schema: {
          example: {
            id: 1,
            benefitId: 'BENEFIT123',
            status: 'Pending',
            applicationData: {
              applicantName: 'John Doe',
              age: 25,
              income: 50000
            },
            customerId: 'CUST123',
            bapId: 'BAP456',
            calculatedAmount: '1000.00',
            finalAmount: '1200.00',
            createdAt: '2024-03-20T10:00:00Z',
            updatedAt: '2024-03-20T10:00:00Z'
          }
        }
      },
      badRequest: {
        status: 400,
        description: 'Bad Request - Invalid input data'
      }
    }
  },

  findAll: {
    operation: {
      summary: 'Get all applications',
      description: 'Retrieve a list of all applications with optional filtering.',
    },
    query: {
      description: 'Query parameters for filtering applications',
      schema: {
        example: {
          status: 'Pending',
          benefitId: 'BENEFIT123',
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }
      }
    },
    responses: {
      success: {
        status: 200,
        description: 'List of applications retrieved successfully',
        schema: {
          example: {
            data: [
              {
                id: 1,
                benefitId: 'BENEFIT123',
                status: 'Pending',
                applicationData: {
                  applicantName: 'John Doe',
                  age: 25,
                  income: 50000
                },
                customerId: 'CUST123',
                bapId: 'BAP456',
                calculatedAmount: '1000.00',
                finalAmount: '1200.00',
                createdAt: '2024-03-20T10:00:00Z',
                updatedAt: '2024-03-20T10:00:00Z'
              }
            ],
            total: 1,
            page: 1,
            limit: 10
          }
        }
      }
    }
  },

  findOne: {
    operation: {
      summary: 'Get a single application by ID',
      description: 'Retrieve detailed information about a specific application.',
    },
    param: {
      name: 'id',
      description: 'Application ID',
      example: 1
    },
    responses: {
      success: {
        status: 200,
        description: 'Application retrieved successfully',
        schema: {
          example: {
            id: 1,
            benefitId: 'BENEFIT123',
            status: 'Pending',
            applicationData: {
              applicantName: 'John Doe',
              age: 25,
              income: 50000
            },
            customerId: 'CUST123',
            bapId: 'BAP456',
            calculatedAmount: '1000.00',
            finalAmount: '1200.00',
            createdAt: '2024-03-20T10:00:00Z',
            updatedAt: '2024-03-20T10:00:00Z'
          }
        }
      },
      notFound: {
        status: 404,
        description: 'Application not found'
      }
    }
  },

  update: {
    operation: {
      summary: 'Update an application by ID',
      description: 'Update the details of an existing application.',
    },
    param: {
      name: 'id',
      description: 'Application ID',
      example: 1
    },
    body: {
      description: 'Updated application data',
      schema: {
        example: {
          status: 'Approved',
          applicationData: {
            applicantName: 'John Doe',
            age: 25,
            income: 55000
          },
          finalAmount: '1300.00'
        }
      }
    },
    responses: {
      success: {
        status: 200,
        description: 'Application updated successfully',
        schema: {
          example: {
            id: 1,
            benefitId: 'BENEFIT123',
            status: 'Approved',
            applicationData: {
              applicantName: 'John Doe',
              age: 25,
              income: 55000
            },
            customerId: 'CUST123',
            bapId: 'BAP456',
            calculatedAmount: '1000.00',
            finalAmount: '1300.00',
            createdAt: '2024-03-20T10:00:00Z',
            updatedAt: '2024-03-20T11:00:00Z'
          }
        }
      },
      badRequest: {
        status: 400,
        description: 'Bad Request - Invalid input data'
      },
      notFound: {
        status: 404,
        description: 'Application not found'
      }
    }
  },

  updateStatus: {
    operation: {
      summary: 'Update Application Status',
      description: 'Update the status of an application (approved or rejected).',
    },
    param: {
      name: 'id',
      description: 'Application ID',
      example: 1
    },
    body: {
      description: 'Status update data',
      schema: {
        example: {
          status: 'Approved',
          remark: 'All documents verified'
        }
      }
    },
    responses: {
      success: {
        status: 200,
        description: 'Status updated successfully',
        schema: {
          example: {
            statusCode: 200,
            status: 'success',
            message: 'Application approved successfully'
          }
        }
      },
      badRequest: {
        status: 400,
        description: 'Bad Request - Status is required'
      }
    }
  },

  calculateBenefit: {
    operation: {
      summary: 'Calculate Benefit Amount',
      description: 'Calculate the benefit amount for a specific application based on its criteria and rules.',
    },
    param: {
      name: 'id',
      description: 'Application ID',
      example: 1
    },
    responses: {
      success: {
        status: 200,
        description: 'Benefit amount calculated successfully',
        schema: {
          example: {
            tuitionAdminReimbursement: 10000,
            disabilityAllowance: 4000,
            maintenanceAllowanceTotal: 19200,
            bookAndStationaryGrantTotal: 1500,
            totalPayout: 34700
          }
        }
      },
      notFound: {
        status: 404,
        description: 'Application not found'
      }
    }
  }
}; 