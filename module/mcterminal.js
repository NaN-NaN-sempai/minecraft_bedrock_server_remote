const { spawn } = require('child_process');
const {Readable} = require('stream'); 
    

module.exports = class Server {
    constructor() {
        this.auxStartServer();
    }
    input (str){
        let stdinStream = new Readable({ read() { } });
        stdinStream.push(str + '\n'); 
        stdinStream.pipe(this.terminal.stdin);
    }
    output (func) {
        this.execOnStdout = func;
    }
    auxStartServer() {
        this.terminal = spawn('./server/bedrock_server.exe');

        this.terminal.stdin.setEncoding('utf-8');
        this.terminal.stdout.pipe(process.stdout);
        

        this.terminal.stdout.on('data', (data) => { 
            if(typeof this.execOnStdout == "function")
                this.execOnStdout(data.toString());
        });

        this.terminal.on('exit', (code) => {
            console.log(`Child exited with code ${code}`);
        });
    }
    reset() {
        this.terminal.kill("SIGINT");
        this.auxStartServer();
    }
}

