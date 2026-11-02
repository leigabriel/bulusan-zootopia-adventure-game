// Cross-platform wrapper for the Android Gradle build.
// usage: node scripts/gradle.mjs <gradle task>   e.g. assembleDebug | bundleRelease
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const task = process.argv[2];
if (!task) {
    console.error('Usage: node scripts/gradle.mjs <gradle task>');
    process.exit(1);
}

const isWindows = process.platform === 'win32';
const env = { ...process.env };
if (!env.JAVA_HOME && isWindows) {
    const studioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
    if (existsSync(studioJbr)) env.JAVA_HOME = studioJbr;
}

const gradle = isWindows ? 'gradlew.bat' : './gradlew';
const result = spawnSync(gradle, [task], { cwd: 'android', env, stdio: 'inherit', shell: isWindows });
process.exit(result.status ?? 1);
