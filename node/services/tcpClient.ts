import net from 'net';

const startClient = (port: number, host: string) => {
  const client = new net.Socket();

  client.connect(port, host, () => {
    console.log(`Connected to server on ${host}:${port}`);
    client.write('Hello world!');
  })

  client.on('data', (data: any) => {
    console.log(`Server says : ${data} `);
  });

  client.on('close', () => {
    console.log('Connection closed');
  });

  client.on('error', (error: any) => {
    console.error(`Connection error ${error}`);
  });
}

export default { startClient }
