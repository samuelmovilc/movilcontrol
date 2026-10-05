const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Client :: ready');
  conn.exec('docker inspect papeleria_app_mariadb | grep MYSQL', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '89.117.56.39',
  port: 22,
  username: 'root',
  password: 'Henogo0521*'
});
