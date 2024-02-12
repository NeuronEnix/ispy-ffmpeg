#!/usr/bin/env zx

import fs from 'fs/promises'
import 'zx/globals'

// Constants
const inDir = "ispy"
const outDir = "out"
const tmpDir = "tmp"
const MAX_CONCURRENT_GROUPS = Number(await $`nproc`.quiet()) - 1;
let counter = 0;
const deleteTmpFiles = true;
console.time("All done in");

// Setup
await $`rm -rf ${outDir} ${tmpDir}`;
await $`mkdir ${outDir} ${tmpDir}`;

// get all video files
const videoFiles = await fs.readdir(inDir);


// group files by date
const groups = {};
for (const file of videoFiles) {
    const date = file.split('_')[1];
    if (groups[date]) {
        groups[date].push(file);
    } else {
        groups[date] = [file];
    }
}
const filesGroupedByDate = Object.values(groups);


// write grouped files to tmp dir
const writeFilesPm = filesGroupedByDate.map(files => {
    const dateString = files[0].split('_')[1];
    return fs.writeFile(
        `${tmpDir}/${dateString}`,
        files.map(e => `file '../${inDir}/${e}'`).join("\n")
    )
})
await Promise.all(writeFilesPm);


// Metadata print
console.log("\nConcurrency:", MAX_CONCURRENT_GROUPS);
console.log("Total files:", videoFiles.length);
console.log("Files grouped by date:", filesGroupedByDate.length);



// Use generator to process grouped files
const it = function* () { yield* filesGroupedByDate;}()


// Recursively process grouped files
async function rec() {
    const { value, done } = it.next();
    if (done) return;
    const dateString = value[0].split('_')[1];
    const inFile = `${tmpDir}/${dateString}`
    const outFile = `${outDir}/${dateString}.mkv`
    const startTime = new Date().valueOf();
    await $`ffmpeg -f concat -safe 0 -i ${inFile} -c:v copy -c:a aac ${outFile}`.quiet();
    if (deleteTmpFiles) await $`rm ${inFile}`.quiet();
    console.log(`Done (${++counter}/${filesGroupedByDate.length}): ${outFile} | ${parseInt((new Date().valueOf() - startTime)/1000)}s`);
    if ( counter >= filesGroupedByDate.length ) {
        console.timeEnd("All done in");
    }
    rec()
}

// Start processing grouped files with MAX_CONCURRENT_GROUPS
let con = MAX_CONCURRENT_GROUPS;
while (con--) {
    rec()
}
