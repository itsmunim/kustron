const inquiries = [
  {
    name: 'name',
    message: `Name of your application:`,
  },
  {
    name: 'namespace',
    message: `Namespace messages to isolate kubernetes resources for your application;
    if not given, name will be used as default:`,
  },
  {
    name: 'port',
    message: `The service port. e.g. 8080`,
  },
  {
    name: 'healthcheck',
    message: `The healthcheck path. Needed to define readiness probe- it should just return 200
      when hit. e.g. '/health'. Readiness probe informs ingress to know when your service is
      ready to serve.`,
  },
  {
    type: 'list',
    name: 'language',
    message: `In which language your app is written? A respective dockerfile will also be generated:`,
    choices: ['java', 'nodejs', 'golang'],
    default: 'java',
  },
  {
    type: 'list',
    name: 'exposed',
    message: `Denotes if the app should be exposed publicly. Based on this a proper service setup
    will be done and ingress will be defined:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'list',
    name: 'allowhttp',
    message: `If exposed is true, then this one defines if http is allowed or only https is:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'list',
    name: 'enableautoscale',
    message: `Should enable autoscaling of pods or not. If set, then 'minreplicas' and 'maxreplicas'
     should be provided:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
  },
  {
    type: 'number',
    name: 'minreplicas',
    message: `Minimum number of service pods:`,
    default: 2,
  },
  {
    type: 'number',
    name: 'maxreplicas',
    message: `Max number of service pods:`,
    default: 20,
  },
  {
    type: 'number',
    name: 'cputhreshold',
    message: `HPA to decide when to increase number of pods based on cpu usage of each pod:`,
    default: 75,
  },
  {
    type: 'number',
    name: 'memthreshold',
    message: `HPA to decide when to increase number of pods based on memory usage of each pod:`,
    default: 70,
  },
  {
    name: 'cpulimit',
    message: `The cpu limit for each pod in a scale where 1 vCPU = 1000m:`,
    default: '500m',
    validate: isValidCPU,
  },
  {
    name: 'initialcpu',
    message: `The initial cpu amount for each pod in a scale where 1 vCPU = 1000m:`,
    default: '150m',
    validate: isValidCPU,
  },
  {
    name: 'memorylimit',
    message: `The highest memory limit for each pod either in Gi(GB) or Mi(MB):`,
    default: '1Gi',
    validate: isValidMem,
  },
  {
    name: 'initialmemory',
    message: `The initial memory amount for each pod either in Gi(GB) or Mi(MB):`,
    default: '512Mi',
    validate: isValidMem,
  },
];

function isValidCPU(input) {
  const isValid = /[\d]+m/.test(input);
  if (!isValid) {
    throw new Error('Has to be of this format: 100m, 150m, 200m etc.');
  }
  return isValid;
}

function isValidMem(input) {
  const isValid = /[\d]+Mi|Gi/.test(input);
  if (!isValid) {
    throw new Error('Has to be of this format: 100Mi, 500Mi, 2Gi etc.');
  }
  return isValid;
}

function replaceWithBoolean(input) {
  return input === 'yes';
}

module.exports = inquiries;
