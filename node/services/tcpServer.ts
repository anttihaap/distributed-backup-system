import net from 'net';

const startServer = (tcpServerPort: number, host: string) => {

  const server = net.createServer();
  
  server.listen(tcpServerPort, host, () => {
    console.log(`Server started on ${host}:${tcpServerPort}`);

    server.on('connection', (socket: any) => {
      console.log(`New connection to ${socket.remotePort}`);
      const client = socket   // for testing
    
      socket.on('data', (data: any) => {
        console.log(`Client msg: ${data}`);
        socket.write('Server received your message: ' + data.toString())
        client.destroy()      // for testing
      });
    
      socket.on('close', () => {
        console.log(`Client on port ${socket.remotePort} closed the connection.`);
      });
    
      socket.on('error', (error: any) => {
        console.error(`Something went wrong: ${error}`);
      });
    })
  })  
}

export default { startServer }
