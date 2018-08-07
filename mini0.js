const cp = require('child_process'),
  ptool = require('path'),
  net = require('net');

const info = {};
info.abi = execSync('adb shell getprop ro.product.cpu.abi');
info.sdk = execSync('adb shell getprop ro.build.version.sdk');
[info.w, info.h] = execSync(`sh -c "adb shell dumpsys window | grep -Eo 'init=[0-9]+x[0-9]+'"`).match(/\d+/g)

function execSync(cmd) {
  console.log('execSync', cmd);
  let out = cp.execSync(cmd, { encoding: 'utf8' }).trim();
  if (out) console.log('output', out);
  return out;
}

function exec(cmd) {
  console.log('exec', cmd);
  let proc = cp.exec(cmd, {
    encoding: 'utf8'
  });
  proc.stdout.on('data', d=> console.log('stdout', d));
  proc.stderr.on('data', d=> console.log('stderr', d));
  const killCP = () => {
    console.log('stopping proc:' + cmd);
    proc.kill();
  };
  process.on('exit', killCP);
  process.on('SIGTERM', killCP);
  return proc;
}

const bindir = (base) => ptool.join(base, info.abi, 'bin');
const libdir = (base) => ptool.join(base, info.abi, 'lib', 'android-' + info.sdk);

const fwdAbs = (hport, absname) => execSync(`adb forward tcp:${hport} localabstract:${absname}`);
const fwdPort = (hport, aport) => execSync(`adb forward tcp:${hport} localabstract:${aport}`);

const execSocket = (cmd, port, name, cbData, cbExit) => {
  fwdAbs(port, name);
  const proc = exec(cmd);
  proc.stdout.on('data', d => {
    if (!proc.hasSocket) setTimeout(() => {
      if (proc.hasSocket) return; proc.hasSocket = true;
      trySocket(proc, port, name, cbData, cbExit);
    }, 100);
  });
  return proc;
};

function trySocket(proc, port, name, cbData, cbExit) {
  if (!proc.socketTry) proc.socketTry = 1;
  else proc.socketTry++;
  console.log('starting stream', port, name, proc.socketTry);
  proc.socket = net.connect({ port });
  proc.socket.on('data', cbData);
  proc.socket.on('error', err => console.log('stream error', port, name, err));
  proc.socket.on('end', () => {
    console.log(`socket ${port}/${name} has closed - program may need to be restarted.`);
    if (proc.socketTry < 5) setTimeout(() => {
      trySocket(proc, port, name, cbData, cbExit);
    }, 2000);
  });
  if (proc.socketTry == 1) {
    const onExit = () => {
      console.log('stopping stream', port);
      if (typeof cbExit === 'function') cbExit();
      proc.socket.end();
    };
    process.on('exit', onExit);
    process.on('SIGTERM', onExit);
  }
}

module.exports = {
  info, exec, execSync, execSocket,
  bindir, libdir,
  fwdAbs, fwdPort
};