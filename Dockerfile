FROM node:20-slim

# Установка C++ компилятора и утилит сборки для raknet-native
RUN apt-get update && apt-get install -y \
    python3 \
    g++ \
    make \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 7860

CMD ["npm", "start"]
