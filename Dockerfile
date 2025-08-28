FROM node:20 as dependencies

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else (including prisma/)
COPY . .

# Optional check to confirm schema exists
RUN ls -la prisma/schema.prisma

# Generate Prisma client
RUN npx prisma generate

# Run migrations
#RUN npx prisma migrate dev --name init
#RUN npx prisma migrate reset --force

# Build project
RUN npm run build

EXPOSE 7000

CMD ["npm", "start"]
