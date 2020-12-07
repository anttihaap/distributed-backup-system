# Distributed Backup System

This is a project work for the *Distributed Systems* course (University of Helsinki, fall 2020). The goal of this system is to provide a peer-to-peer network for distributed file backup. More details can be found in the [report](./REPORT.md).

## Running the network

Six example nodes numbered from 1 to 5 and 9 are configured in the *config.json* file. A single node can be started with command 
`LOCAL_NODE_ID=<nodeId> npm start` in the *node/* folder. Start each node in its own terminal, beginning with node number 9 since it has no other node to connect to.

For example

`LOCAL_NODE_ID=9 npm start`    
`LOCAL_NODE_ID=1 npm start`    
`LOCAL_NODE_ID=2 npm start`    
`LOCAL_NODE_ID=3 npm start`    

will start four nodes and form a ring overlay network.

## File backups

Moving or copying a file to node specific *files/<local_node_id>* folder in the root (*node/*) will automatically start the backup process. The `amountOfContractsPerFile` variable in *config.json* defines the number of contracts (backup copies). It is set by default to 2.

## Running with a tracker server (optional)

A tracker server can be used instead of the peer network to keep track of the nodes. In that case, the `useTracker` variable in *config.json* should be set to true. The tracker is started first by running `npm start` in the */tracker* folder. Nodes can then join with `LOCAL_NODE_ID=<nodeId> npm start`.
