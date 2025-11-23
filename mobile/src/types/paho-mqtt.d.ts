declare module 'paho-mqtt' {
  export class Client {
    constructor(host: string, port: number, path: string, clientId: string);
    onConnectionLost?: (responseObject: any) => void;
    onMessageArrived?: (message: Message) => void;
    connect(options: any): void;
    subscribe(topic: string, options?: any): void;
    send(message: Message): void;
    isConnected(): boolean;
    disconnect(): void;
  }
  export class Message {
    constructor(payload: string);
    destinationName: string;
    payloadString?: string;
  }
}


