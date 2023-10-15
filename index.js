let mcServerIp = '100.93.51.24';
let mcServerPort = 19132;
let remoteTerminalPort = 3001;

const mcterminal = require("./module/mcterminal");
const mcServer = new mcterminal();


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



let stdoutRawText = "";
let stdoutText = "";

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get('/getStdout', (req, res) => {
    res.send(stdoutText);
});

app.post('/sendInput', upload.none(), (req, res) => {
    let {visitorId, command} = req.body;

    let restart = false;
    if(command == "restart server") {
        stdoutRawText="";
        mcServer.reset();
        restart = true;
    }

    let usageObject = req.body;

    usageObject.isUserInput = true;

    stdoutRawText += `stopt{${JSON.stringify(usageObject)}}enopt [${visitorId}] ${command}\r\n`;
    if(!restart) mcServer.input(req.body.command);
});

io.on('connection', (socket) => {});

server.listen(remoteTerminalPort, () => console.log(`Remote Terminal in port: ${remoteTerminalPort}`));

mcServer.output(data => { 
    stdoutRawText += data
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


        if(text == "Server started.")
            onServerReady();

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


let onServerReadyList = {};
let serverStartedBool = false;
const onServerReady = () => {
    if(serverStartedBool) return;
    serverStartedBool = true;

    Object.keys(onServerReadyList).forEach(name => {
        console.log(`On Server Ready: Running ${name}...`);
        onServerReadyList[name]();
        console.log(`On Server Ready: ${name} done.`);
    })
}


/* 
    USE CLIENT INSTEAD
*/

const bedrock = require('bedrock-protocol');

let playerList = [];

// STU stands to Server Tool User
onServerReadyList.loginSTU = () => {
    let clientUsername = "NWS STU";
    const client = bedrock.createClient({
        host: mcServerIp,   // optional
        port: mcServerPort,         // optional, default 19132
        username: clientUsername,   // the username you want to join as, optional if online mode
        offline: true       // optional, default false. if true, do not login with Xbox Live. You will not be asked to sign-in if set to true.
    })

    const sendCommand = (title, command) => {
        stdoutRawText += `[NWS STU - ${title}] ${command}\r\n`;
        mcServer.input(command);
    }

    

    client.on('spawn', (packet) => {
        sendCommand("Setup - Gamemode", `gamemode spectator "${clientUsername}"`);
        sendCommand("Setup - Teleport", `tp "${clientUsername}" 12093 66 1412`);
    })

    client.on('text', (packet) => { // Listen for chat messages from the server and echo them back.
        if (packet.source_name != client.username) {
            if(packet.message.startsWith(":")){
                let command = packet.message.slice(1);
                sendCommand("User Command", command);
                client.queue('text', {
                    type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '',
                    message: `Command sent!`
                })
            }
        }
    });

    client.on("player_list", packet => { 
        if (packet.records.records[0].username != client.username) {
            if(packet.records.type == "add"){
                let {username, uuid} = packet.records.records[0];
                
                let find =  playerList.find(p => p.uuid == uuid);

                if(!find){
                    playerList.push({
                        username,
                        uuid,
                        online: true
                    });
                } else {
                    let index = playerList.findIndex(p => p.uuid == uuid);

                    playerList[index].online = true;

                }

            } else if (packet.records.type == "remove") {
                let {uuid} = packet.records.records[0];
                
                let index = playerList.findIndex(p => p.uuid == uuid);

                if(index != -1) {
                    playerList[index].online = false;
                }
            } 
        }
    });
}