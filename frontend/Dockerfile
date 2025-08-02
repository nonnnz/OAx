FROM oven/bun:1 as frontend-build

WORKDIR /app

# Environment variables
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_LIFF_ID
ENV VITE_LIFF_ID=${VITE_LIFF_ID}
ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}

# Copy package files and install dependencies
COPY package*.json ./
COPY bun.lock ./
RUN bun install

# Copy rest of the app and build
COPY . .
RUN bun run build

# Use nginx to serve the built app
FROM nginx:alpine
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173