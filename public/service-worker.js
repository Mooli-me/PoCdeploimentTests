const precache = {
  id: 'v0.0.0',
  paths: [
    './',
    '/index.html',
    '/manifest.json',
    '/script.js',
    '/styles.css',
    '/service-worker.js',
    '/img/logo.png'
  ]
};

const appVersion = 2;

let worker;
let db;
let channel;

let clickCounter = 0;
let secondsCounter = 0;

function updateDB (ev) {
  const updateProcesses = [
      (db) => {
          console.log('There is no DB');
      },
      (db) => {
          console.log('Create DB first version');
          db.createObjectStore("times", { keyPath: "timestamp" });
      },
      (db) => {
          console.log('Update to version 2');
          db.createObjectStore("binaries", { keyPath: "sha256" });
      },
      (db) => {
          console.log('Update to version 3');
      }
  ];

  const db = ev.target.result;

  if ( ev.newVersion > updateProcesses.length - 1 ) {
      console.error(`Can't handle this DB version. Old version: ${ev.oldVersion}, new version:${ev.newVersion}.` );
      return;
  }

  for ( let version = ev.oldVersion + 1 ; version <= ev.newVersion ; version ++ ) {
      const process = updateProcesses[version];
      process(db);
  }
  
}

function openDB () {

  if (!self.indexedDB) {
      console.error("Browser doesn't seems to support IndexDB");
      return;
  }

  const dbConnection = indexedDB.open('thingsDB', appVersion);

  dbConnection.onupgradeneeded = updateDB;

  dbConnection.onsuccess = (ev) => {
      db = ev.target.result;
      console.log('DB opened.')
      console.log('DB stores:',db.objectStoreNames);
  }

  dbConnection.onerror = (ev) => console.error('Error opening DB:', ev.target.errorCode);

}

function addObjectToDB (obj, db, storeName) {

  const transaction = db.transaction(storeName, 'readwrite');
  transaction.oncomplete = ev => console.log('Transaction done for worker.');
  transaction.onerror = ev => console.error('Transaction error:', ev);

  const store = transaction.objectStore(storeName);
  const resquest = store.add(obj)
  resquest.onsuccess = (ev) => console.log('Time added to DB.');

  channel.postMessage(
      {
          type: 'DBUpdate',
          storeName,
          obj
      }
  );

}

function deleteDBItem (item) {
  const deleteTransaction = db.transaction('times', 'readwrite');
  deleteTransaction.onerror = ev => console.error('Transaction error removing item: ', ev);

  const deleteKeystore = deleteTransaction.objectStore('times');
  const result = deleteKeystore.delete(item);
  result.error = err => console.error(err);
}

function cleanDB () {

  const getKeysTransaction = db.transaction('times', 'readonly');
  getKeysTransaction.onerror = ev => console.error('Transaction error reading keys:', ev);

  const readKeystore = getKeysTransaction.objectStore('times');
  const getKeysRequest = readKeystore.getAllKeys()

  getKeysRequest.onsuccess = ev => {
    const keys = ev.target.result;

    if ( keys.length <= 10 ) return;

    const oldKeys = keys.slice( 0, keys.length - 11 );
    oldKeys.forEach( element => deleteDBItem(element) );
  }
}

function writeDateToDB (datetime) {

  const now = parseInt(datetime)

  const obj = {
      timestamp: now,
      string: Date(now)
  }

  addObjectToDB(obj, db, 'times');

}

function createChannel () {
  console.log('Opening broadcast channel and setting handlers.');
  const channel = new BroadcastChannel('main');
  channel.addEventListener('message', (ev) => {
    console.log('Message received in service worker.');
    switch (ev.data.type) {
      case 'click':
        clickCounter++;
        channel.postMessage(
          {
            type: 'clicks',
            value: clickCounter
          }
        );
        break;
      case 'clean':
        console.log('Cleaning request.')
        cleanDB();
        break;
      case 'notificationsGranted':
        console.log('Opening permanent notification.');
        openPermanentNotification();
      default:
        console.error('Unknown message type.')
        break;
    }
  });

  return channel
}

function newSubscription () {
  console.log('Subscribing.')
  const subscription = new EventSource('/subscription');
  subscription.addEventListener('open', ev => console.log('Subscription opened.') );
  subscription.addEventListener('update', ev => writeDateToDB(ev.data) );
  subscription.addEventListener('welcome', ev => console.log('Got subscription response:', ev.data) );
  return subscription
}

function preloadCache (ev) {
  ev.waitUntil(
    caches.open(precache.id)
      .then(
        cache => cache.addAll(precache.paths)
      )
      .then(
        self.skipWaiting()
      )
  );
}

function openPermanentNotification () {
  if ( Notification.permission === 'granted' ) {
      self.registration.showNotification(
          'Mooli.me PoC', 
          {
              body: 'Here I\'m!',
              icon: '/img/logo.png',
              image: '/img/logo.png',
              requireInteraction: true,
              actions: [
                  {
                      action: 'close',
                      title: 'Close',
                  }
              ]
          }
      )
  }
}

function notificationsHandler (ev) {
  if (ev.action === 'close') openPermanentNotification();
}

function main () {
  openDB();
  channel = createChannel();
  const subscription = newSubscription();
}


self.addEventListener('install', preloadCache );

self.addEventListener('activate', main);

self.addEventListener('notificationclick', notificationsHandler)
