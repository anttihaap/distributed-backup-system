# Distributed File Backup System

Checkout [README.md](https://github.com/anttihaap/distributed-backup-system/blob/main/README.md) for technical manual.

## Project goals and core functionality

The goal of this system is to provide a peer-to-peer network for distributed file backup. A peer that provides storage for other nodes can use other available node's storage but a peer that will not provide storage for others cannot backup its files to other nodes. A file can be backed up on one to n nodes. A node can propose a contract for storage for other nodes. Nodes that accept the proposal will sign the contract and the file transfer will begin.

The overlay network forms a ring of nodes. When a new node joins, its place in the network circle will be calculated based on its id value. The new node will receive information (an address and a port) about its predecessor and successor. The node lists of each individual node will be updated periodically and the network can tolerate multiple nodes leaving or joining. A node that has left the network will be identified with the same id when it re-joins the network.

## The design principles

The goal of the project was to design a decentralized distributed P2P system. The resulting system should be scalable and reasonably fault tolerant depending on the number of copies a node has made of a file. For fault tolerance, nodes should be able to join and leave the network without warning. Since the files are saved in n number of backup nodes, there is a known and accepted risk that all backup nodes might be unavailable at the same time. When at least one of the backup nodes re-joins the network, the file will be available again.

### Technologies

- JavaScript with TypeScript on Node.js runtime environment.
- For running the network locally, the nodes were run as individual processes in their own ports.

### Architecture

The peer nodes of the network form a ring as in the Chord protocol. A node has a UDP component and a TCP component that can act both as a client or as a server. The UDP component is used for sending and receiving messages between the nodes. The file transfer between two nodes is handled by the TCP component. All the nodes in the network are symmetrical with the same functionalities. Every node keeps a node list containing the other nodes in the network.

### Process

??? ???

### Communication

The messaging between the nodes (e.g. proposing a contract for nodes in the network, nodes joining the network) is conducted with UDP. The file transfer is done over TCP connection for reliability. Messages are passed clockwise in the ring when a new node joins. When the address of the receiving node is known (e.g. file's backup nodes), messages are sent directly between the two nodes. PING messages (for refreshing node state) are multicast to all nodes.

#### Joining the network:    

In order to join the network, the address and port of some node already in the network has to be known. The network uses a messaging protocol with the following message strings:

    JOIN:nodeId:host:port                               The joining node (nodeId) sends JOIN to a node that it knows in the network.
    ACK_JOIN:nodeId:host:port:predId:predHost:predPort  A node that accepts JOIN (nodeId) sends ACK_JOIN to the joining node
    NOTIFY:nodeId:host:port                             The joining node (nodeId) sends NOTIFY to its new predecessor
    NEW_NODE:nodeId:host:port                           This message will be passed around the ring after the new node (nodeId) has joined

When a node wants to join the network it sends a JOIN message to a node that it knows in the network. The JOIN message is passed clockwise in the network from smaller nodeId value to greater until the right place is found. The node that will be the successor to the new node sends an ACK_JOIN to the joining node with information about its current predecessor. It also updates the new node to its predecessor.    

After receiving the ACK_JOIN, the joining node will set its successor and predecessor based on the information received from the acking node. It will then send NOTIFY to the predecessor. The predecessor will in turn update its successor to be the new node.

After joining the network and setting predecessor and successor, the new node will send NEW_NODE message to its successor to be passed around the ring clockwise. The network nodes will add the new node to their node lists with a timestamp.

First and second nodes in the network (special case):

* When the second node joins the first (and only) node, both nodes are set as a predecessor and a successor to each other. In that case, NOTIFY message is not sent.
* When the second node joins, the first node will send FIRST_ACK instead of normal ACK_JOIN to notify the joining node that it will be both its predecessor and successor

#### Updating the network

    PING:nodeId:host:port:contractRequest               Sent periodically to update TTL and contract request status

Every node in the network will send a PING message frequently to other nodes to notify that they are still alive. The message also contains a boolean value to indicate if the node is willing to accept new file contracts. When a node receives a PING message it will update the sending node on its node list with a fresh timestamp and the contract request status.

An update function is run periodically to remove expired nodes from the node list. The predecessor and successor are also updated in this function, if necessary.

#### Creating a contract and transferring files:

## The key enablers and lessons learned

We started the development process with building a system with one tracker that was responsible of bookkeeping. Other nodes communicated with the tracker over HTTP with basic end-points:
- /subscribe: When a new node joins the network it makes a POST request with nodeId and address
- /nodes: A node makes a GET request and receives a list of active nodes as a response
- /ping: A node makes a POST request here with nodeId periodically to announce that it is still alive

We decided that the nodes in the network would communicate directly with each other using UDP and TCP. Our proof-of-concept system consisted of nodes that could send UDP messages to all other nodes, commmunicate with the tracker over HTTP, and act as both a TCP server and a client.

After the hybrid model of the P2P network was up we decided to try to get rid of the tracker server completely, and to design a network consisting of only equal peers. After considering our options we created a ring shaped overlay network. In our system there is no need to find a certain key efficiently but we needed to create a network that would be reasonably easy to keep updated. It should also tolerate nodes leaving and joining abruptly. The ring overlay seemed to suit those purposes well. When writing the code for the node network, debugging the ring was time consuming and in the hindsight, the ring could have been planned better. The resulting code certainly has some room for improvement and maybe a few too many ifs and comparisons...

The contract manager and file transfer ... ...

The schedule of the project was tight but manageable. 

## Scaling and performance

The network is very scalable and our hashing and naming protocol will in theory enable 2<sup>32</sup> nodes to join the network. In practice, hash collisions would probably happen (this has not been solved in the project). Joining the network will happen in O(n) time, as the NEW_NODE message will go around the whole circle to notify other nodes. The PING messages to keep the nodes timestamp fresh will currently be sent to all nodes in the network. This will result in n<sup>2</sup> messages in the network sent every ten seconds. This will not be a problem in the smaller networks tested for this project but for networks with perhaps thousands of nodes, a more efficient way of messaging should be implemented. For instance, a node list could be restricted to only hold 10 nearest successors and the nodes with backup files.

## Functionalities 

### Naming

Each node has a unique identifier that is hashed from its address string (host:port) using SHA-1. However, only the first six characters of the hash string are used as an identifier in order to avoid values that are too large for comparing when the node joins the ring. When a node re-joins, it will receive the same identifier. It will again be discoverable by other nodes that may have files backed up with that node.

### Node discovery

When a node has joined the network [(see: Joining the network)](#Joining-the-network) it will be added to all other nodes' node lists. It will start receiving PINGs that all of the nodes are broadcasting to their node lists. The new node will then add the nodes whose PINGs it has received to its own node list. The node lists will be updated periodically and nodes with expired timestamps will be removed.

### Consistency and synchronization

To ensure the consistency of the overlay network, the nodelists are updated frequently. 

### Fault tolerance and recovery

When a node leaves suddenly, the other nodes stop receiving its PINGs. After a node's timestamp has expired, that node will be removed from the nodelists. Checking of the timestamps and updating the lists occurs with twenty second intervals. The update function alse checks if the predecessor or successor needs to be updated due to the expired node. The nodes will PING more frequently than the update function is run, so a couple of lost PING messages will be tolerated. When a node re-joins the network, it will receive the same id and join with the usual protocol [(see: Joining the network)](#Joining-the-network).

All nodes in the network will send PING messages periodically to let other nodes know that they are still alive. All nodes will update their node lists with the time of the last PING. If a node has not PINGed in a while it will be removed from the nodelists and the predecessor and successor of affected nodes will be updated.

### Logging

Event and error logging is handled with *winston* package. The logs of an individual node are written to local files.

## Further development? Improvements?

- The tracker node could be added to the network either as a standalone node for bookkeeping and aiding in node discovery or as a "supernode" in the ring. The latter would mean implementing an HTTP component in the nodes as well.
- In a real world solution, all nodes would probably communicate through the same port. That would simplify our code.
- Updating the node lists may create too many messages in larger scale. Node lists could be optimized to only contain a certain number of nodes. In this project we could not test with large enough number of nodes to really benefit from that kind of optimization.
- Security ...

## Code repository

https://github.com/anttihaap/distributed-backup-system

## Participants and their contributions

Antti Haapaniemi: Tracker, contract management, file management, file transfer, demo, documentation    
Saara Koskipää: Node network, UDP client, logging, demo, documentation
