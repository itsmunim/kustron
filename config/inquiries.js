const inquiries = [
  {
    name: 'name',
    message: `Application Name:`,
  },
  {
    name: 'namespace',
    message: `Namespace(If not given application name will be used):`,
  },
  {
    name: 'port',
    type: 'number',
    message: `Service Port:`,
    default: 8080,
    validate: isValidPort,
    filter: replaceNaN(8080),
  },
  {
    name: 'healthcheck',
    message: `Healthcheck Path:`,
    default: '/health',
  },
  {
    type: 'list',
    name: 'language',
    message: `Application Language(will generate respective dockerfile):`,
    choices: ['java', 'nodejs', 'golang'],
    default: 'java',
  },
  {
    type: 'list',
    name: 'exposed',
    message: `Is Public(ingress will be created if the service or app is public)?:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'list',
    name: 'allowhttp',
    message: `Allow Http(if exposed was YES, this value should be provided; default is NO)?:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'list',
    name: 'enableautoscale',
    message: `Enable Autoscaling?:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'number',
    name: 'minreplicas',
    message: `Min Num of Pods(effective only if autoscaling has been turned on):`,
    default: 2,
    filter: replaceNaN(2),
  },
  {
    type: 'number',
    name: 'maxreplicas',
    message: `Max Num of Pods(effective only if autoscaling has been turned on):`,
    default: 20,
    filter: replaceNaN(20),
  },
  {
    type: 'number',
    name: 'cputhreshold',
    message: `Max CPU Usage(per pod, if usage is more; autoscaling kicks in):`,
    default: 75,
    filter: replaceNaN(75),
  },
  {
    type: 'number',
    name: 'memthreshold',
    message: `Max Memory Usage(per pod, if usage is more; autoscaling kicks in):`,
    default: 70,
    filter: replaceNaN(70),
  },
  {
    name: 'cpulimit',
    message: `CPU Limit(per pod, in 1 vCPU = 1000m format):`,
    default: '500m',
    validate: isValidCPU,
  },
  {
    name: 'initialcpu',
    message: `Initial CPU(per pod, in 1 vCPU = 1000m format):`,
    default: '150m',
    validate: isValidCPU,
  },
  {
    name: 'memorylimit',
    message: `Memory Limit(per pod, in Gi[GB] or Mi[MB]):`,
    default: '1Gi',
    validate: isValidMem,
  },
  {
    name: 'initialmemory',
    message: `Initial Memory(per pod, in Gi[GB] or Mi[MB]):`,
    default: '512Mi',
    validate: isValidMem,
  },
];

function isValidPort(input) {
  return validate(
    input,
    /[\d]{4}/,
    'Has to be of this format: 8080, 9091, 4200 etc.'
  );
}

function isValidCPU(input) {
  return validate(
    input,
    /[\d]+m/,
    'Has to be of this format: 100m, 150m, 200m etc.'
  );
}

function isValidMem(input) {
  return validate(
    input,
    /[\d]+Mi|Gi/,
    'Has to be of this format: 100Mi, 500Mi, 2Gi etc.'
  );
}

function replaceWithBoolean(input) {
  return input === 'yes';
}

function replaceNaN(defaultVal) {
  return (input) => {
    return Number.isNaN(input) ? defaultVal : input;
  };
}

function validate(value, regex, errMsg) {
  const isValid = regex.test(value);

  if (!isValid) {
    throw new Error(errMsg);
  }

  return isValid;
}

module.exports = inquiries;
