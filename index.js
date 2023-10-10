const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const multer = require('multer');
const upload = multer();


const stream = require('stream');

let port = 3001;


let stdoutText = "";

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/index.html");
})
app.get('/getStdout', (req, res) => {
    res.send(stdoutText);
})
app.get('/socket.io.js', (req, res) => {
    res.sendFile(__dirname + "/socket.io.js");
})

io.on('connection', (socket) => {});

app.post('/api', upload.none(), (req, res) => {
    sendMessage(req.body.ipt);
})

server.listen(port, () => console.log(`Listening on port ${port}`));



const sendMessage = (t) => {
    var stdinStream = new stream.Readable({ read() { } });
    stdinStream.push(t + '\n'); 
    stdinStream.pipe(child.stdin);
}

const { spawn } = require('child_process');

const child = spawn('./server/bedrock_server.exe');
    
child.stdin.setEncoding('utf-8');
child.stdout.pipe(process.stdout);

child.stdout.on('data', (data) => {
    stdoutText += data.toString() + "\n";
    io.emit('stdout', stdoutText); 
});

child.on('exit', (code) => {
    console.log(`Child exited with code ${code}`);
});