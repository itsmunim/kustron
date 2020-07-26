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
    message: `Healthcheck Path(default is /health):`,
    default: '/health',
  },
  // app - expose public or private?
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
    message: `Allow Http(default is NO)?:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
    when: function (answers) {
      return answers.exposed;
    },
  },
  // app - autoscaling setup
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
    message: `Min Num of Pods:`,
    default: 2,
    filter: replaceNaN(2),
    when: function (answers) {
      return answers.enableautoscale;
    },
  },
  {
    type: 'number',
    name: 'maxreplicas',
    message: `Max Num of Pods:`,
    default: 20,
    filter: replaceNaN(20),
    when: function (answers) {
      return Boolean(answers.enableautoscale);
    },
  },
  {
    type: 'number',
    name: 'cputhreshold',
    message: `Max CPU Usage(per pod, if usage is more; autoscaling kicks in):`,
    default: 75,
    filter: replaceNaN(75),
    when: function (answers) {
      return Boolean(answers.enableautoscale);
    },
  },
  {
    type: 'number',
    name: 'memthreshold',
    message: `Max Memory Usage(per pod, if usage is more; autoscaling kicks in):`,
    default: 70,
    filter: replaceNaN(70),
    when: function (answers) {
      return Boolean(answers.enableautoscale);
    },
  },
  // app - resource limits
  {
    name: 'cpulimit',
    message: `CPU Limit(per pod, in 1000m = 1vCPU format):`,
    default: '500m',
    validate: isValidCPU,
  },
  {
    name: 'initialcpu',
    message: `CPU Request(per pod, in 1000m = 1vCPU format):`,
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
    message: `Memory Request(per pod, in Gi[GB] or Mi[MB]):`,
    default: '512Mi',
    validate: isValidMem,
  },
  // app - ci/cd
  {
    type: 'list',
    name: 'generatepipeline',
    message: `Generate Pipeline(only gitlab and deployment into GCP is supported)?:`,
    choices: ['yes', 'no'],
    default: 'no',
    filter: replaceWithBoolean,
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
