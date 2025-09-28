import { exec } from 'child_process';
import { join } from 'path';

console.log('Starting DealSphere Python Backend...');

// Change to python_backend directory and start the server
const pythonBackendPath = join(process.cwd(), 'python_backend');
const command = `cd "${pythonBackendPath}" && PORT=5000 python simple_server.py`;

console.log(`Executing: ${command}`);

const child = exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  console.log(`Stdout: ${stdout}`);
});

// Forward stdout and stderr from the Python process
child.stdout?.on('data', (data) => {
  console.log(data.toString());
});

child.stderr?.on('data', (data) => {
  console.error(data.toString());
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, terminating Python backend...');
  child.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, terminating Python backend...');
  child.kill('SIGTERM');
  process.exit(0);
});