const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Client :: ready');
  
  const cmd = `
    docker exec papeleria_app_mariadb mysql -u root -pR00t#C0nt4b0_P0S!2026 -e "CREATE DATABASE IF NOT EXISTS saas_master;"
    docker exec papeleria_app_mariadb mysql -u root -pR00t#C0nt4b0_P0S!2026 -e "GRANT ALL PRIVILEGES ON saas_master.* TO 'pos_user'@'%'; FLUSH PRIVILEGES;"
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Comandos de creación ejecutados.');
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
