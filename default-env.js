/**
 * Fetches `VCAP_SERVICES` for a given CF application and writes it to a file.
 * It utilizes the Cloud Foundry CLI to do so.
 *
 * Make sure you are logged in via the CF CLI (`cf login`) before running the
 * script. You can check your login and the organization and space you are
 * targetting by using `cf target`.
 *
 * Allows on-premise connectivity proxying if necessary
 *
 * @author Sebastian Blessing
 */
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const spawn = util.promisify(require('child_process').spawn);

async function getAppGuid(appName) {
  const cmd = `cf app ${appName} --guid`;
  console.log(cmd);
  const { stdout, stderr } = await exec(cmd);
  if (stderr) console.log(`stderr: ${stderr}`);
  return stdout.trim();
}

async function getDefaultEnv(appGuid) {
  const cmd = `cf curl "v3/apps/${appGuid}/env"`;
  console.log(cmd);
  const { stdout, stderr } = await exec(cmd);
  if (stderr) console.log(`stderr: ${stderr}`);
  return JSON.parse(stdout).system_env_json;
}

(async () => {
  const myArgs = process.argv.slice(2);
  const appName = myArgs[0];
  if (!appName) {
    console.error('Please provide a CF application name to fetch its environment!');
    return;
  }

  let envFileName = myArgs[1];

  envFileName = envFileName ? envFileName : 'default-env.json';
  console.log(`Writing environment of ${appName} to ${envFileName}`);

  const defaultEnv = await getDefaultEnv(await getAppGuid(appName));

  let bRunProxy = false;
  let proxyPort = null;
  let proxyHost = null;

  if (defaultEnv['VCAP_SERVICES']['connectivity']) {
    proxyPort = defaultEnv.VCAP_SERVICES.connectivity[0].credentials.onpremise_proxy_port;
    proxyHost = defaultEnv.VCAP_SERVICES.connectivity[0].credentials.onpremise_proxy_host;
    defaultEnv.VCAP_SERVICES.connectivity[0].credentials.onpremise_proxy_host = 'localhost';
    bRunProxy = true;
  }

  fs.writeFile('default-env.json', JSON.stringify(defaultEnv, null, 2), async (err) => {
    if (err) {
      console.error(err);
    } else if (bRunProxy) {
      console.log(`cf ssh ${appName} -L ${proxyPort}:${proxyHost}:${proxyPort}`);
      await spawn('cf', [`ssh ${appName} -L ${proxyPort}:${proxyHost}:${proxyPort}`], {
        shell: true,
        stdio: 'inherit',
      });
    }
  });

  console.log('Done');
})();
