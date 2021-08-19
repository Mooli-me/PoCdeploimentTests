const express = require('express');

const PORT = process.env.PORT || 3000;

const app = express();

let subscriptors = [];

let subscriptionsCounter = 0;

app.use(express.static(__dirname + '/public'));

async function removeSubscriptor (id) {
    console.log(`Client ${id} closes connection.`);
    subscriptors = subscriptors.filter(item => item.id !== id );
}

async function subscriptionHandler (req, res, next) {

    console.log('New subscriptor.')
    
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };

    res.writeHead(200, headers);

    res.write('retry: 500\n');
    res.write('event: welcome\n');
    res.write('data: Welcome.\n\n');

    const subscriptor = {
        id: subscriptionsCounter++,
        connection: res
    }

    subscriptors.push(subscriptor);

    req.on('close', () => removeSubscriptor(subscriptor.id) );
}

async function sendMessage () {
    console.log('Sending message to subscriptors.')
    subscriptors.forEach(
        subscriptor => {
            subscriptor.connection.write(`retry: 500\n`)
            subscriptor.connection.write(`event: update\n`)
            subscriptor.connection.write(`data: ${Date.now()}\n\n`)
        }
    )
}

app.get('/subscription', subscriptionHandler);

app.listen( PORT , ()=>{
    console.log(`Running and lisening in http://localhost:${PORT}.`);
});

setInterval(sendMessage,3000);