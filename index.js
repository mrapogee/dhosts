#!/usr/bin/env node

const program = require("commander");
const util = require("util");
const os = require("os");
const path = require("path");
const openEditor = require("open-editor");
const fs = require("fs").promises;
const cp = require("child_process");
const sudoPrompt = require("sudo-prompt");

const mkdirp = util.promisify(require("mkdirp"));
const prompts = require("prompts");
const projectName = "dhosts";
const configDirectory = path.join(os.homedir(), `.config/${projectName}`);

const text = async (name, message) => {
  return (await prompts([
    {
      type: "text",
      name: name,
      message: message
    }
  ]))[name];
};

const confirm = async (name, message) => {
  return (await prompts([
    {
      type: "confirm",
      name: name,
      message: message
    }
  ]))[name];
};

const choice = async (name, message, choices) => {
  const index = (await prompts([
    {
      type: "select",
      name: name,
      choices,
      message: message
    }
  ]))[name];

  return choices[index].value;
};

const checkConfiguration = () => {
  return fs
    .stat(configDirectory)
    .then(() => true)
    .catch(() => false);
};

const fetchCurrentProfile = () => {
  return fs
    .readFile(path.join(configDirectory, "current-profile"), "UTF-8")
    .catch(() => null);
};

const fetchProfiles = () => {
  return fs.readdir(path.join(configDirectory, "profiles"));
};

const createProfile = async () => {
  const name = await text(
    "new-profile-name",
    "What would you like to call this profile? (ex. my-project)"
  );

  await fs.writeFile(path.join(configDirectory, "profiles", name), "");

  console.log(`✅ Created profile '${name}'`);

  return name;
};

const getCurrentProfile = async commandName => {
  if (!(await checkConfiguration())) {
    if (
      await confirm(
        "init",
        `No ${projectName} configuration initialized. Create?`
      )
    ) {
      await initConfig();
    } else {
      throw new Error(
        `Please run \`${projectName} init\` to use \`${commandName}\``
      );
    }
  }

  let currenProfile = await fetchCurrentProfile();

  if (currenProfile != null) {
    return currenProfile;
  }

  const profiles = await fetchProfiles();

  if (profiles.length === 0) {
    if (
      await confirm("init-profile", "No profile created. Create a new one?")
    ) {
      const newProfile = await createProfile();
      await setCurrentProfile(newProfile);

      return newProfile;
    } else {
      throw new Error(
        `Please create a dev hosts profile to use \`${commandName}\``
      );
    }
  } else {
    return null;
  }
};

const getProfileLocation = name => {
  return path.join(configDirectory, "profiles", name);
};

const portPattern = /^([^\s:]*)(:(\d+))?$/;
const hostPattern = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
const ipv4Pattern = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const ipv6Pattern = /(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;

const getPort = string => {
  const match = string.match(portPattern);

  if (match == null) {
    throw new Error(`Invalid value ${string}`);
  }

  return {
    name: match[1],
    port: match[3]
  };
};

const parseMapping = (from, to) => {
  const { name: hostname, port: hostPort } = getPort(from);
  const { name: ipAddress, port: ipPort } = getPort(to);

  if (!hostPattern.test(hostname)) {
    throw new Error(`expected ${hostname} to be hostname`);
  }

  if (
    ipAddress !== "" &&
    !ipv4Pattern.test(ipAddress) &&
    !ipv6Pattern.test(ipAddress)
  ) {
    throw new Error(
      `expected ${ipAddress} to be an IPV4 or IPV6 address, or omitted for the local machine address (127.0.0.1)`
    );
  }

  if (ipPort != null && ipAddress !== "" && ipAddress !== "127.0.0.1") {
    throw new Error(
      `You can only map to local ports, use :${ipPort}, or 127.0.0.1:${ipPort}`
    );
  }

  if (hostPort === "" && ipPort !== "") {
    throw new Error(
      "Specifiy a port for both the local machine and the host name, ex: dev.mysite.com:80 :3000"
    );
  }

  if (hostPort != null) {
    return {
      type: "portForward",
      hostname: hostname,
      hostPort: hostPort,
      localPort: ipPort
    };
  }

  return {
    type: "hostsMapping",
    hostname,
    ipAddress
  };
};

const getDefaultHosts = () => {
  return fs
    .readFile(path.join(configDirectory, "default-hosts"), "utf-8")
    .catch(() => "");
};

const activateMappings = async mappings => {
  const portForwards = mappings.filter(
    mapping => mapping.type === "portForward"
  );

  const hostsMappings = new Map();
  mappings.forEach(mapping => {
    if (mapping.type === "hostSmapping") {
      hostsMappings.set(mapping.hostname, mapping.ipAddress);
    } else {
      hostsMappings.set(mapping.hostname, "127.0.0.1");
    }
  });

  const resetPorts = `sudo pfctl -F all -f /etc/pf.conf`;

  const pfCommand = `
echo "
${portForwards
  .map(
    forward =>
      `rdr pass inet proto tcp from any to ${forward.hostname} port ${
        forward.hostPort
      } -> 127.0.0.1 port ${forward.localPort}`
  )
  .join("\n")}
" | sudo pfctl -Ef -`.trim();

  const newHosts = `
${await getDefaultHosts()}
${Array.from(hostsMappings.entries())
  .map(([host, ip]) => `${ip} ${host}`)
  .join("\n")}
`;

  const hostsCommand = `sudo echo "${newHosts}" | sudo tee /etc/hosts`;

  await util.promisify(cp.exec)(hostsCommand);
  await util.promisify(cp.exec)(resetPorts);

  if (portForwards.length > 0) {
    await util.promisify(cp.exec)(pfCommand);
  }
};
const activateProfile = async profile => {
  const result = await fs.readFile(getProfileLocation(profile), "UTF-8");

  const mappings = result
    .split("\n")
    .map(line => line.split(/#/)[0])
    .map(line => line.trim())
    .filter(line => line != "")
    .map(line => line.split(/\s+/g))
    .map(([from, to]) => parseMapping(from, to));

  return activateMappings(mappings);
};

const setCurrentProfile = async profile => {
  const profiles = await fetchProfiles();

  if (!profiles.includes(profile)) {
    profile = await chooseProfile(
      "profile",
      `No profile called ${profile}. Choose a profile to activate:`
    );
  }

  await fs.writeFile(path.join(configDirectory, "current-profile"), profile);
  await activateProfile(profile);
};

const addMappingToProfile = async (from, to, profile) => {
  parseMapping(from, to);
  await fs.appendFile(getProfileLocation(profile), `\n${from} ${to}`);
  console.log(`✅  added mapping '${from} ${to}' to profile ${profile}`);

  const currentProfile = await fetchCurrentProfile();

  if (currenProfile === profile) {
    await activateProfile(currentProfile);
  }
};

const chooseProfile = async (name, message) => {
  const profiles = await fetchProfiles();
  const pickedProfile = await choice(namea, message, [
    ...profiles.map(profile => ({ title: profile, value: profile })),
    { title: "New Profile", value: null }
  ]);

  if (pickedProfile === null) {
    return await createProfile();
  }

  return pickedProfile;
};

const addMapping = async (from, to, profile) => {
  if (profile != null) {
    return addMappingToProfile(from, to, profile);
  }

  const currentProfile = await getCurrentProfile(from, to);

  if (currentProfile != null) {
    return addMappingToProfile(from, to, profile);
  }

  const profileChoice = await chooseProfile(
    "profile",
    "No active profile. Which would you like to add this to?"
  );

  return addMappingToProfile(from, to, profileChoice);
};

const initConfig = async () => {
  const profiles = path.join(configDirectory, "profiles");

  if (await checkConfiguration()) {
    throw new Error(
      `Configuration already exists. Delete ${configDirectory} to reset your profiles.`
    );
  }

  const confirmed = await confirm(
    "y",
    `Creating ${projectName} configuration at ${configDirectory}. Ok?`
  );

  if (confirmed) {
    await mkdirp(profiles);

    console.log(
      `\n✅  Done. Use \`${projectName} new <profile-name>\` or \`${projectName} map <from> <to>\` to get started.`
    );
  } else {
    throw new Error("Initialization cancelled.");
  }
};

const cleanExit = command => {
  return async (...args) => {
    try {
      return await command(...args);
    } catch (e) {
      console.error(`\n❌  ${e.message}\n`);
      process.exit(1);
    }
  };
};

program
  .command("init")
  .description(`Setup ${projectName} configuration at ~/.config/${projectName}`)
  .action(cleanExit(initConfig));

program
  .command("map <hostname> <ip>")
  .option(
    "-p, --profile <profile-name>",
    "Profile to add mapping to. Defaults to the active profile."
  )
  .description(
    `Map hosts (map my.dev 127.0.0.1), or map specific ports (map my.dev:80 127.0.0.1:3000)`
  )
  .action(
    cleanExit((from, to, options) => {
      return addMapping(from, to, options.profile);
    })
  );

program
  .command("activate <profile>")
  .description("Activate a profile")
  .action(cleanExit(setCurrentProfile));

program
  .command("edit <profile>")
  .description("Open a profile in $EDITOR")
  .action(
    cleanExit(profile => {
      const file = getProfileLocation(profile);
      openEditor([file]);
    })
  );

program
  .command("update")
  .description(
    "Updates OS hosts and port settings to your current configured settings."
  )
  .action(
    cleanExit(async () => {
      const profile = await fetchCurrentProfile();

      if (profile) {
        activateProfile(profile);
      } else {
        activateMappings([]);
      }
    })
  );

program
  .command("edit-default")
  .description(
    "Edit default hosts. Default hosts are always loaded, for mappings like: `localhost 127.0.0.1`"
  )
  .action(
    cleanExit(() => {
      const file = path.join(configDirectory, "default-hosts");
      openEditor([file]);
    })
  );

program.action(() => {
  console.error("\n❌  Command not found\n");
  console.log(program.helpInformation());
  process.exit(1);
});

if (process.argv.length === 2) {
  console.log(program.helpInformation());
} else {
  program.parse(process.argv);
}
