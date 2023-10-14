let mcServerIp = '100.93.51.24';
let mcServerPort = 19132;
let mcServerRelayPort = 3002;
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


        if(title.includes("INFO") && text == "Server started.")
            serverStarted();

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


let serverStartedBool = false;
const serverStarted = () => {
    if(serverStartedBool) return;
    serverStartedBool = true;

    //relayOnStart();
}



const { Relay } = require('bedrock-protocol')

const relayOnStart = () => {
    console.log("Relay started");
    const relay = new Relay({
        /* host and port to listen for clients on */
        host: mcServerIp,
        port: mcServerPort,
        maxPlayers: 100,
        offline: true,
        /* Where to send upstream packets to */
        destination: {
            host: mcServerIp,
            port: mcServerRelayPort
        }
    })
    relay.listen() // Tell the server to start listening.
    
    let methods = []; 
    
    relay.on('connect', player => {
        //console.log(player);
        console.log('New connection', player.connection.address)
    
        // Server is sending a message to the client.
        player.on('clientbound', ({ name, params }, des) => {
            if (name === 'disconnect') { // Intercept kick
                params.message = 'Intercepted' // Change kick message to "Intercepted"
            }
        })
        // Client is sending a message to the server
    
        player.on('serverbound', (evt, des) => {
            let { name, params } = evt; 
    
            if(!methods.includes(name)) {
                methods.push(name);
                //console.log(name);
            }
    
            if(name == "move_player") {
                // params.position.x / y / z  
            }
        
            if (name === 'text') { // Intercept chat message to server and append time.
                console.log(params.message);
                if(params.message.startsWith(";")){
                    let command = params.message.slice(1);

                    
                    let restart = false;
                    if(command == "restart server") {
                        stdoutRawText="";
                        mcServer.reset();
                        restart = true;
                    }

                    stdoutRawText += `[from relay] ${command}\r\n`;
                    if(!restart) mcServer.input(command);
                }
                params.message += `, on ${new Date().toLocaleString()}` 
            }
            
            if (name === 'command_request') { // Intercept command request to server and cancel if its "/test"
                if (params.command == "/test") {
                des.canceled = true
                } 
            }
        })
    })
}