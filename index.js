const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('src'));

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
});

app.get('/getStdout', (req, res) => {
    res.send(stdoutText);
});

io.on('connection', (socket) => {});

app.post('/api', upload.none(), (req, res) => {
    let {visitorColor, visitorId, command, visitorColorContrast} = req.body;

    let date = new Date();
    
    var timeString = date.toString().slice(16, 24);
    let stringDate = date.toLocaleDateString("en-US").slice(0, 5) + " - " + timeString;

    stdoutText += /* html */`
    <br>
    <br>
    <span class="userInput" style="--color: ${visitorColor}; --contrast: ${visitorColorContrast}" title="${stringDate}">

        [<div class="userName">${visitorId}</div>] => "<span class="command" style="user-select: all">${command}</span>"

    </span>
    <br>`;
    sendMessage(req.body.command);
});

server.listen(port, () => console.log(`Listening on port ${port}`));

const sendMessage = (t) => {
    var stdinStream = new stream.Readable({ read() { } });
    stdinStream.push(t + '\n'); 
    stdinStream.pipe(terminal.stdin);
}

const { spawn } = require('child_process');

const terminal = spawn('./server/bedrock_server.exe');
    
terminal.stdin.setEncoding('utf-8');
terminal.stdout.pipe(process.stdout);


terminal.stdout.on('data', (data) => { 

    let fullText = data.toString();
    let text = fullText.split("\n");

    let date = new Date();

    let sryledText = text.map(s => {
        if(s.startsWith("[")){
            let aux = s.slice(s.indexOf("]")+1, s.length);
            var timeString = date.toString().slice(16, 24);
            let stringDate = date.toLocaleDateString("en-US").slice(0, 5) + " - " + timeString;

            return `<span title="${stringDate}"> [stdout] -> ${aux} </span>`;
        }
        else return s;
    }).join("<br>");
    

    stdoutText += sryledText;
    io.emit('stdout', stdoutText); 
});

terminal.on('exit', (code) => {
    console.log(`Child exited with code ${code}`);
});