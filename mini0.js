const cp = require('child_process'),
  ptool = require('path');

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
  proc.stdout.on('data', console.log);
  proc.stderr.on('data', console.log);
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
module.exports = {
  info, exec, execSync,
  bindir, libdir,
  fwdAbs, fwdPort
};