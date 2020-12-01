const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3000
const requestIp = require('request-ip')

const { JsonDB } = require('node-json-db')
const { Config } = require('node-json-db/dist/lib/JsonDBConfig')

let db = new JsonDB(new Config("test", true, true, '/'))

const cron = require('node-cron')

// NODE TIME TO LIVE IN SECONDS
const nodeTTL = 1;

app.use(bodyParser.json())
app.use(requestIp.mw())

/*
  Subscribe a client to tracker.

  body: { port, nodeId }

  'port': What UDP client will use.
  'nodeId': Random nodeId, will reject if in use. (TODO: typing better, assumed integer here.)
 */
app.post('/subscribe', (req, res) => {
  const port = req.body.port
  const tcpPort = req.body.tcpPort
  const nodeId = req.body.nodeId
  if (!port || !nodeId) {
    res.status(400)
    console.log('bad request')
    console.log(req.body)
    res.send({ error: "bad request" })
    return
  }

  console.log(`Node ${nodeId} listens to udp-port ${port}`)

  /*
  try {
    // TODO: you can steal a node id so...
    const data = db.getData("/" + nodeId)
    console.log(new Date() + " - FAIL TO ADD NODE - Node:", nodeId)
    res.send({ error: "node with id already subscribed" })
  } catch (error) {
    */
    const node = {
      nodeId: nodeId,
      ip: req.clientIp,
      port,
      tcpPort: tcpPort,
      lastUpdate: new Date().getTime()
    }
    console.log(new Date() + " - ADD NODE - Node:", nodeId)
    db.push("/" + nodeId, node)
    res.status(200).send(node)
    /*
  }
  */
})

/*
  Ping to keep node alive. Should be done every 30 sec or for now? TTL for node is 1min for our testing.
  (TODO: currently based on trust)
  
  body: { nodeId }

  'nodeId'
*/
app.post("/ping", (req, res) => {              // Should this be POST end-point (because request body)?
  const nodeId = req.body.nodeId
  const contractRequest = req.body.contractRequest
  try {
    const data = db.getData("/" + nodeId)
    const node = {
      lastUpdate: new Date().getTime(),
      contractRequest: !!contractRequest

    }
    db.push("/" + nodeId, {
      ...data,
      lastUpdate: new Date().getTime(),
      contractRequest: !!contractRequest
    })
    console.log(new Date() + " - PING - Node: " + nodeId)
    res.send({})
  } catch (error) {
    console.log(new Date() + " - PING FAIL - Node: " + nodeId)
    res.status(400).send({ error: "node is not subscribed" })
  }
})

app.get("/nodes", (req, res) => {
  const data = db.getData("/")
  let arr = [];
  for(const [_, value] of Object.entries(data)) {
    arr.push(value)
  }
  res.send(arr)
})

// We want to use ipv4 only, so we have the address to listen to in ipv4.
app.listen(port, '127.0.0.1', () => {
  console.log(`Traker listening at http://127.0.0.1:${port}`)
})

// Clear a list of nodes, if they havne't pinged for 'nodeTTL' time
cron.schedule('*/1 * * * *', () => {
  console.log(new Date() + " - START check TTL of NODES")
  for (let [key, value] of Object.entries(db.getData("/"))) {
    if (value.lastUpdate + nodeTTL * 60 * 1000 < new Date().getTime()) {
      db.delete("/" + key)
      console.log(new Date() + "- TTL EXPIRED - DELETE Node:" + key)
    }
  }
});
