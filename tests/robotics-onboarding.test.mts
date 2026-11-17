import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roboticsSdkRevision,roboticsSdkUrl,roboticsInstallCommand,roboticsIntegrationPrompt} from '../src/lib/roboticsGuide.ts';
test('native onboarding pins actual reviewed source and starts with offline simulation',()=>{
 assert.match(roboticsSdkRevision,/^[a-f0-9]{40}$/);
 assert.ok(roboticsSdkUrl.endsWith('/tree/'+roboticsSdkRevision));
 assert.ok(roboticsInstallCommand.includes('--rev '+roboticsSdkRevision));
 assert.match(roboticsInstallCommand,/--locked/);
 assert.match(roboticsInstallCommand,/demo --execute-simulation/);
 assert.doesNotMatch(roboticsInstallCommand,/pip install|\.whl|--allow-navigation|CBGPU_API_KEY=/);
});
test('integration prompt preserves user drivers and separates hardware commissioning and distro features',()=>{
 assert.ok(roboticsIntegrationPrompt.includes(roboticsSdkRevision));
 for(const text of ['--features ros2','--features ros2-humble','module:factory','--cbgpu-method METHOD','terminal action result','NO wheel encoders','Never auto-clear crash locks','Do not declare physical tests passed']) assert.ok(roboticsIntegrationPrompt.includes(text),text);
 assert.doesNotMatch(roboticsIntegrationPrompt,/--adapter my_robot:create|--adapter cbgpu_robotics/);
});
