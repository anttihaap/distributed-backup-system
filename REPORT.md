# Distributed File Backup System

## Project goals and core functionality

The goal of this system is to provide a peer-to-peer network for distributed file backup. A peer that provides storage for other nodes can use other available node's storage. A peer that will not provide storage for others can not backup its files to other nodes. A file can be backed up on one to n (or more) nodes. A node can propose a contract for storage for other nodes. Nodes that accept will sign the contract and the file transfer can begin. To be continued...

## The design principles

The goal is to design a decentralized distributed P2P system. (structured/unstructured?) 
The resulting system should be scalable and reasonably fault tolerant depending on the number of copies a node has made of the file. Communication between the nodes should be ... ...


### Technologies

JavaScript with TypeScript on Node.js runtime environment

### Architecture

### Process

### Communication

The messaging between the nodes (e.g. proposing a contract for multiple nodes in the network) is conducted with UDP. The file transfer is done over TCP for reliability.

Message protocol: ... ... ...

## The key enablers and lessons learned

We started the development process with building a system with one tracker that was responsible of bookkeeping. Other nodes communicated with the tracker over HTTP with basic end-points:
- /subscribe: When a new node joins the network it makes a POST request with nodeId and address
- /nodes: A node makes a GET request and receives a list of active nodes as a response
- /ping: A node makes a POST request here with nodeId periodically to announce that it is still alive

We decided that nodes would communicate directly with other nodes using UDP and TCP. Our proof-of-concept system consisted of nodes that could send UDP messages to all other nodes, commmunicate with the tracker, and act as both a TCP server and a client.    

Designing the communication ... contracts ...

After the hybrid model of the P2P network was up we decided to try to get rid of the tracker server completely and design a network of only equal peers. After considering our options we decided to create ... ...

## Scaling and performance

## Functionalities 

(naming and node discovery, consistency and synchronization, fault tolerance and recovery, etc?) For instance, fault tolerance and consensus when a node goes down.

### Naming

Each node has a unique identifier that is hashed from its address (host:port) ??? using ...

## Further development? Improvements?

## Code repository

https://github.com/anttihaap/distributed-backup-system
