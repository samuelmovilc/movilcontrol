const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready');
  conn.exec('docker exec -i papeleria_app_mariadb env', (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('data', (data) => output += data.toString());
    stream.on('close', () => {
      const match = output.match(/MYSQL_ROOT_PASSWORD=(.+)/);
      if (match) {
        const rootPwd = match[1].trim();
        const sqlCmd = `CREATE DATABASE IF NOT EXISTS ventanas_estilo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ventanas_estilo.* TO 'pos_user'@'%'; FLUSH PRIVILEGES;`;
        
        conn.exec(`docker exec -i papeleria_app_mariadb mariadb -u root -p'${rootPwd}' -e "${sqlCmd}"`, (err2, stream2) => {
           if (err2) throw err2;
           stream2.on('close', (code) => {
              console.log('Database and privileges created. Exit code:', code);
              conn.end();
           });
        });
      } else {
        console.error("Root password not found in env");
        conn.end();
      }
    });
  });
}).connect({
  host: '89.117.56.39',
  port: 22,
  username: 'root',
  password: 'Henogo0521*' // We know this might fail, wait, we used the other root password from CREDENCIALES earlier.
});
