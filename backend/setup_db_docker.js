const { Client } = require('ssh2');

const sql = `
CREATE DATABASE IF NOT EXISTS motos_app;
CREATE USER IF NOT EXISTS 'pos_user_moto'@'%' IDENTIFIED BY 'M0t0s!4#S3cur3_2026';
GRANT ALL PRIVILEGES ON motos_app.* TO 'pos_user_moto'@'%';
FLUSH PRIVILEGES;
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Client :: ready');
  const cmd = `echo "${sql.replace(/\n/g, ' ')}" | docker exec -i papeleria_app_mariadb mysql -uroot -pR00t#C0nt4b0_P0S!2026`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
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
