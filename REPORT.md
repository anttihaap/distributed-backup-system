# Distributed File Backup System

Checkout [README.md](https://github.com/anttihaap/distributed-backup-system/blob/main/README.md) for technical manual.

## Project goals and core functionality

The goal of this system is to provide a peer-to-peer (p2p) network for distributed file backups. The backups work with the "tit for tat" strategy, meaning that peers exchange backups with each other. If a peer want's to backup a file, it needs to backup an other peers file. We call this exchange a *contract*. Multiple contracts can be created for single a file to make the backups more failure tolerant. The contract is enforced by exchaning proofs that the backups are still in place. This strategy prevents free riding as the contracts require participance from both nodes.

Our p2p network forms a structured overlay ring network. Joining nodes are placed in the network circle depening on its own id value. After successfully joining the network, the node will receive information (an address and a port) about its predecessor and successor. The node lists of each individual node are updated periodically. The network tolerates multiple nodes leaving or joining the network. On rejoining the network, a node will be identified with the same node id.

## The design principles

The goal of this project is to design a decentralized distributed P2P system that fulfills a certain goal. Also the resulting system should scale and and be reasonably fault tolerant. Fault tolerance is acheived by distributing multiple copies of a file to nodes in the network. Also nodes should be able to join and leave the network without warning. Since the files are backuped in 1..n number of nodes, there is a known and accepted risk that all backup nodes might be unavailable at the same time. When at least one of the backup nodes re-joins the network, the file will be available again.

## Technologies

- JavaScript with TypeScript on Node.js runtime environment.
- UDP for peer communication and TCP for file transfers.
- For running the network locally, the nodes were run as individual processes in their own ports.

## Architecture

The peer nodes of the network form a ring as in the Chord protocol. A node has a UDP component and a TCP component that can act both as a client or as a server. The UDP component is used for sending and receiving messages between the nodes. The file transfer between two nodes is handled by the TCP component. All the nodes in the network are symmetrical with the same functionalities. Every node keeps a node list containing the other nodes in the network.

The architecture of the peer network and backup processes are described below. 

## Process

The nodes run as separate processes, which can exist or not in the same machine. They are single threaded as Node.js is used. 

## Communication

The messaging between the nodes (e.g. proposing a contract for nodes in the network, nodes joining the network) is conducted with UDP. The file transfer is done over TCP connection for reliability. Messages are passed clockwise in the ring when a new node joins. When the address of the receiving node is known (e.g. file's backup nodes), messages are sent directly between the two nodes. PING messages (for refreshing node state) are multicast to all nodes. Nodes communicate directly via UDP on the backup process.

## Peer network architecture

### Joining the network:    

In order to join the network, the address and port of some node already in the network has to be known. The network uses a messaging protocol with the following message strings:

| Command | Description |
| --- | --- |
|    JOIN:nodeId:host:port                               | The joining node (nodeId) sends JOIN to a node that it knows in the network. |
|    ACK_JOIN:nodeId:host:port:predId:predHost:predPort  | A node that accepts JOIN (nodeId) sends ACK_JOIN to the joining node |
|    NOTIFY:nodeId:host:port                             | The joining node (nodeId) sends NOTIFY to its new predecessor |
|    NEW_NODE:nodeId:host:port                           | This message will be passed around the ring after the new node (nodeId) has joined |

When a node wants to join the network it sends a JOIN message to a node that it knows in the network. The JOIN message is passed clockwise in the network from smaller nodeId value to greater until the right place is found. The node that will be the successor to the new node sends an ACK_JOIN to the joining node with information about its current predecessor. It also updates the new node to its predecessor.    

After receiving the ACK_JOIN, the joining node will set its successor and predecessor based on the information received from the acking node. It will then send NOTIFY to the predecessor. The predecessor will in turn update its successor to be the new node.

After joining the network and setting predecessor and successor, the new node will send NEW_NODE message to its successor to be passed around the ring clockwise. The network nodes will add the new node to their node lists with a timestamp.

First and second nodes in the network (special case):

* When the second node joins the first (and only) node, both nodes are set as a predecessor and a successor to each other. In that case, NOTIFY message is not sent.
* When the second node joins, the first node will send FIRST_ACK instead of normal ACK_JOIN to notify the joining node that it will be both its predecessor and successor

### Updating the network

| Command | Description |
| --- | --- |
| PING:nodeId:host:port:contractRequest | Sent periodically to update TTL and contract request status |

Every node in the network will send a PING message frequently to other nodes to notify that they are still alive. The message also contains a boolean value to indicate if the node is willing to accept new file contracts. When a node receives a PING message it will update the sending node on its node list with a fresh timestamp and the contract request status.

An update function is run periodically to remove expired nodes from the node list. The predecessor and successor are also updated in this function, if necessary.

## Backup process architecture

Backups are created and enforced with a *contract* among nodes.

### Contract negotiation

Module: `node/modules/contract/contractNegotiator.ts`

| Command | Description |
| --- | --- |
| CONTRACT_CREATE:contractId:contractNodeId | Message to create a contract |
| CONTRACT_CREATE_ACK:contractId:contractNodeId:contractId | Message acknowledging to create a contract |
| CONTRACT_PING:contractId:contractNodeId | Ping contract. | 

Nodes that want to backup a file send `CONTRACT_CREATE` requests to it's peers in the network which also want to backup a file. The network (peer network or tracker) includes in the node updates a flag indicating if a node wants create backups or not. A node acknowledges a `CONTRACT_CREATE` request with a `CONTRACT_CREATE_ACK` request. After this both nodes start piging the contract. The contract is called at this stage a *contract candidate*. If a contract candidate doesn't receive a ping for a certain time, the contract candidate will be disregarded.

Node's will not accept any more contract candidates if ther exists anough acknowledged contracts. However, if some node send's an `CONTRACT_CREATE_ACK` it will be accepted. So there can exist more contract candidates that are actually needed. We try to encrease the performance by accepting more candidates but use a competition strategy to cherry-pick the contracts.

After a nodes has a contract candidate that has 3 or more pings. It will cherry-pick the contract candidates that have the most pings. If there is an equal amount of pings in a contract candidate, it will chose one of them.

#### Failure and recovery

Negotations are not recovered on failure because of the competition. It's very likely that the stopped contract candidates will loose the competition. If a node crashes and recovers, the negotiation will start from the beginning.

### Contract file transfer

Modules: `node/modules/contract/contractFileSender.ts` and `node/services/tcpServer.ts`

Nodes listen to a TCP which is one number lower than the UDP port. We took this approach as a convenience to save development time.

Node's will periotically attempt to send the file for the contract. If the file is not sent successfully in about 3mins, the contract will be deleted. In practice this means that the node should negitiate a contract again.

#### Failure and recovery

Recovery can happen in the 3min window. File transfer is an crusial stage of the contracts, so waiting shouldn't be too long. The waiting window could be even smaller.

### Contract management

Module: `node/contractManager.ts`

| Command | Description |
| --- | --- |
| CONTRACT_PING:contractId:contractNodeId | Ping contract. | 

Manages the existing contracts. Sends ping every 10 seconds. Checks that a contract is kept alive by checking that all contracts receive a ping. If a contract doesn't receive ping in 1min it will time out. The contract is kept in the recovery mode for the same time as the contract has been alive. The other participant could have maybe crashed. This is the time window to recover the file. 

Currently the contract will be kept in the recovery mode for the same duration as the contract has been alive. This should be maybe max 1 day.

### Contract proofs

Modules: `node/modules/contract/contractProof.ts`

| Command | Descrpition |
| --- | --- |
| CONTRACT_PROOF:contractId:middlePointForSha1 | Asking for a contract. Should get acknowledgement of 2 sha1 in relation to middle point |

Contract proofs are used to create trust to the contract. The nodes enforce the contract by asking proofs.

Proofs contain a number to the middle point of the file. The middle point is created randomly. The nodes answer with 2 sha1 hashes from the beginning to the middle point and from the middle point to the end of the file. This coveres the whole file on each proof. Also, this mechanism should be solid and no node should be able to cheat it. It's more efficient to store the file than to do any cheating mechanisms.

#### Failure and recovery

A node will ask the same proof for 3mins. If a node recoveres in time and can answer the proof, the contract will stay. If the proof fails, the node can not be trusted and the contract will be deleted. Proofs are only asked from contracts that respond to a ping. The contract manager handles the recovery and setting contracts to recovery mode.

### File recovery

Implementation not done. However there is enough functionality to implement this on top of the existing work. TCP connections can be used to ask for the contract file from the other participant of the contract. 

## The key enablers and lessons learned

We started the development process with building a system with one tracker that was responsible of bookkeeping. Other nodes communicated with the tracker over HTTP with basic end-points:
- /subscribe: When a new node joins the network it makes a POST request with nodeId and address
- /nodes: A node makes a GET request and receives a list of active nodes as a response
- /ping: A node makes a POST request here with nodeId periodically to announce that it is still alive

We decided that the nodes in the network would communicate directly with each other using UDP and TCP. Our proof-of-concept system consisted of nodes that could send UDP messages to all other nodes, commmunicate with the tracker over HTTP, and act as both a TCP server and a client.

### Peer network

After the hybrid model of the P2P network was up we decided to try to get rid of the tracker server completely, and to design a network consisting of only equal peers. After considering our options we created a ring shaped overlay network. In our system there is no need to find a certain key efficiently but we needed to create a network that would be reasonably easy to keep updated. It should also tolerate nodes leaving and joining abruptly. The ring overlay seemed to suit those purposes well. When writing the code for the node network, debugging the ring was time consuming and in the hindsight, the ring could have been planned better. The resulting code certainly has some room for improvement and maybe a few too many ifs and comparisons...

### Backup process

**Consensus**

Creating the contracts is not straight forward. For this reason competition strategy is used to create the contracts. The amount of pings that are received for the contract, creates a consensus that the contract should be maintained.

**Trust**

Trust cannot be guaranteed "as is". There needs to exist some kind of mechanism to create trust among nodes. We use the contract proof mechanism to enforce the contracts, which creates trust among the nodes. It's important to note that nothing enforces the nodes to deliver the backuped files on failure. However, it's a mutual interest to keep the contract in tact. A long contract is a show of trust that the both nodes want to keep. Also this proof mechanism could be extended by asking the file back from time to time.

**Free riding**

Free riding in p2p is an important topic in p2p neworks. There need's to be come kind of mutual exchanges happening to implement free riding prevention mechanisms. For this reason, we use the "tit for tat" strategy for contracts. Both of the nodes have a mutual intrest to keep the contract in place and free riding should be impossible.

## Scaling and performance

The network is very scalable and our hashing and naming protocol will in theory enable 2<sup>32</sup> nodes to join the network. In practice, hash collisions would probably happen (see suggested solution in "Naming and node id" improvements section). Joining the network will happen in O(n) time, as the NEW_NODE message will go around the whole circle to notify other nodes. The PING messages to keep the nodes timestamp fresh will currently be sent to all nodes in the network. This will result in n<sup>2</sup> messages in the network sent every ten seconds. This will not be a problem in the smaller networks tested for this project but for networks with perhaps thousands of nodes, a more efficient way of messaging should be implemented. For instance, a node list could be restricted to only hold 10 nearest successors and the nodes with backup files.

The backup process uses UDP packets for end to end communication. It can scale among the peer network. On very large networks, some limitation should be in place: the node shouldn't try to negotiate with all the nodes.

Nodes are selected by random to create contracts among others. There could be in place a mechanism to select optimal nodes for contracts. Nodes would like to select best and closest nost for fast file transfers and sychronization.

## Functionalities 

### Naming

Each node has a unique identifier that is hashed from its address string (host:port) using SHA-1. However, only the first six characters of the hash string are used as an identifier in order to avoid values that are too large for comparing when the node joins the ring. When a node re-joins, it will receive the same identifier. It will again be discoverable by other nodes that may have files backed up with that node.

### Node discovery

When a node has joined the network [(see: Joining the network)](#Joining-the-network) it will be added to all other nodes' node lists. It will start receiving PINGs that all of the nodes are broadcasting to their node lists. The new node will then add the nodes whose PINGs it has received to its own node list. The node lists will be updated periodically and nodes with expired timestamps will be removed.

### Consistency and synchronization

To ensure the consistency of the overlay network, the nodelists are updated frequently. Contracts are ping'ed and enforced from time to time.

### Fault tolerance and recovery

### Peer network

In the peer network, when a node leaves suddenly, the other nodes stop receiving its PINGs. After a node's timestamp has expired, that node will be removed from the nodelists. Checking of the timestamps and updating the lists occurs with twenty second intervals. The update function alse checks if the predecessor or successor needs to be updated due to the expired node. The nodes will PING more frequently than the update function is run, so a couple of lost PING messages will be tolerated. When a node re-joins the network, it will receive the same id and join with the usual protocol [(see: Joining the network)](#Joining-the-network).

All nodes in the network will send PING messages periodically to let other nodes know that they are still alive. All nodes will update their node lists with the time of the last PING. If a node has not PINGed in a while it will be removed from the nodelists and the predecessor and successor of affected nodes will be updated.

#### Backup process

Explained in architecture section for separate functions.

### Logging

Event and error logging is handled with *winston* package. The logs of an individual node are written to local files.

## Further development and improvements

- The tracker node could be added to the network either as a standalone node for bookkeeping and aiding in node discovery or as a "supernode" in the ring. The latter would mean implementing an HTTP component in the nodes as well.
- In a real world solution, all nodes would probably communicate through the same port. That would simplify our code.
- Updating the node lists may create too many messages in larger scale. Node lists could be optimized to only contain a certain number of nodes. In this project we could not test with large enough number of nodes to really benefit from that kind of optimization.

### Naming and node id

Our system doesn't provide any security for node ids. Node ids can be hijacked. We thought about this topic and suggest to implement the node ids using a public key. For example Ed25519 public-key signature system's public keys can be used as the node id. Ed25519 public keys consume only 32 bytes, which is an acceptable length for the keys and it's advantage.

Node's should be verified by it's signatures. This would add security to the system. A small amount of overhead is added by signing and verifying messages but we feel it's a must have feature.

### Networking

UDP/TCP hole punching should be used to make the system work with NAT's over the internet.

### Backup process

#### Distribute contracts

Currently a node can have 1..n contracts for a file. With the current logic, the contracts are distributed randomly. We would like to make sure that there are not duplicate contracts of the same file for the same node.

#### File size, splitting and encryption

Currently the nodes can send any lengths of files. The backups work with the "tit for tat" stategy. We would like to have the contracts equal to the same amount of bytes. This could be achieved by splitting the file for example to 10M chunks.

Encrpytion should be used. This can be handled in the node client and adds security.

#### Negotiation

The negotation stage could be improved

#### Selecting optimal nodes

To encrease performance, the nodes should select the most optimal nodes to do sychronization and file transfers. In practice, the closes physical nodes should be accepted.

## Code repository

https://github.com/anttihaap/distributed-backup-system

## Participants and their contributions

Design and planning of the system components, demo and documentation done as a joint effort. The actual programming tasks are split a follows.

Antti Haapaniemi: Tracker, contract management, file management, file transfer    
Saara Koskipää: Node network, UDP client, logging
