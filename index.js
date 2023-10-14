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


let stdoutRawText = "";
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

    let usageObject = req.body;

    usageObject.isUserInput = true;

    let date = new Date();
    
    var timeString = date.toString().slice(16, 24);
    let stringDate = date.toLocaleDateString("en-US").slice(0, 5) + " - " + timeString;

    let a = "";

    a += /* html */`
    <br>
    <br>
    <span class="userInput" style="--color: ${visitorColor}; --contrast: ${visitorColorContrast}" title="${stringDate}">

        [<div class="userName">${visitorId}</div>] => "<span class="command" style="user-select: all">${command}</span>"

    </span>
    <br>`;

    stdoutRawText += `stopt{${JSON.stringify(usageObject)}}enopt [${visitorId}] ${command}\r\n`;
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
    stdoutRawText += fullText
        .replaceAll("&","&amp")
        .replaceAll("<","&lt")
        .replaceAll(">","&gt");
    let text = stdoutRawText.split("\r\n");

    let sryledText = text.map(s => {   
        let userObject = {};
        let matchUsr = s.match(/^stopt{.*}enopt /gm);
        if(matchUsr) {
            let obj = matchUsr[0]
                .replace("stopt{", "")
                .replace("}enopt ", "");
                
                userObject = JSON.parse(obj);

            s = s.replace(matchUsr[0],"");
        } 
        
        let match = s.match(/^\[.*] /gm);
        if(!match) return s+"<BR>";

        let title = match[0].slice(1, match[0].length-2)

        let text = s.replace(match[0], "");
        let html = /* html */ `
            <span class="userInput">
                [<div class="title">${title} </div> <span>] ${text? "~> "+text: ""}</span>
            </span>
        `;

        if(userObject.isUserInput){
            with(userObject){

                html = /* html */ `
                    <br>
                    <br>
                    <span class="userInput" style="--color: ${visitorColor}; --contrast: ${visitorColorContrast}">
                        [<div class="title">${title} </div>] => "⠀ <span class="command" style="user-select: all">  ${text} </span> ⠀"
                    </span>
                    <br>
                `;
            }
        }

        return html;
    }).join("");
    
    stdoutText = sryledText;
    io.emit('stdout', sryledText); 
});



terminal.on('exit', (code) => {
    console.log(`Child exited with code ${code}`);
});