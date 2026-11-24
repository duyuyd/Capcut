import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('image upload -> edit text -> PNG download',async({page},info)=>{
 const original=path.join(info.outputDir,'input.png');fs.mkdirSync(info.outputDir,{recursive:true});
 execFileSync('ffmpeg',['-y','-f','lavfi','-i','color=c=purple:s=640x360','-frames:v','1',original],{stdio:'pipe'});
 await page.goto('/photo-editor');await page.locator('input[type="file"]').setInputFiles(original);
 await expect(page.getByRole('button',{name:'PNG'})).toBeEnabled();
 await page.getByRole('button',{name:'Thêm chữ'}).click();
 const file=page.waitForEvent('download');await page.getByRole('button',{name:'PNG'}).click();const downloaded=await file;
 const output=path.join(info.outputDir,'edited-image.png');await downloaded.saveAs(output);expect(fs.statSync(output).size).toBeGreaterThan(1000);
 await info.attach('edited-photo',{path:output,contentType:'image/png'});
});

test('video upload -> trim -> combine -> MP4 download',async({page},info)=>{
 fs.mkdirSync(info.outputDir,{recursive:true});
 const first=path.join(info.outputDir,'first.mp4'),second=path.join(info.outputDir,'second.mp4');
 for(const [color,name] of [['red',first],['blue',second]]){
  execFileSync('ffmpeg',['-y','-f','lavfi','-i','color=c='+color+':s=320x240:r=15','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1.2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',name],{stdio:'pipe'});
 }
 await page.goto('/video-editor');await page.locator('input[type="file"][accept="video/*"]').setInputFiles([first,second]);
 await expect(page.getByText('first.mp4').first()).toBeVisible();
 await expect(page.getByText('second.mp4').first()).toBeVisible();
 await page.getByLabel('Bắt đầu').fill('0.2');await page.getByLabel('Kết thúc').fill('1');
 const saved=page.waitForEvent('download',{timeout:220000});await page.getByRole('button',{name:'Xuất video'}).click();const downloaded=await saved;
 const output=path.join(info.outputDir,'edited-video.mp4');await downloaded.saveAs(output);expect(fs.statSync(output).size).toBeGreaterThan(10000);
 const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',output],{encoding:'utf8'}).trim());expect(duration).toBeGreaterThan(1.1);
 await info.attach('edited-video',{path:output,contentType:'video/mp4'});
});


test('timeline split, undo/redo and IndexedDB restore with real footage',async({page},info)=>{
  fs.mkdirSync(info.outputDir,{recursive:true});
  const clip=path.join(info.outputDir,'timeline.mp4');
  execFileSync('ffmpeg',['-y','-f','lavfi','-i','color=c=green:s=320x240:r=15','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2.0','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',clip],{stdio:'pipe'});
  await page.goto('/video-editor');
  await page.locator('input[type="file"][accept="video/*"]').setInputFiles(clip);
  await expect(page.getByRole('button',{name:'Xóa clip'})).toHaveCount(1);
  await page.getByRole('slider',{name:'Vị trí phát'}).fill('1');
  await page.getByRole('button',{name:'Tách clip',exact:true}).click();
  await expect(page.getByRole('button',{name:'Xóa clip'})).toHaveCount(2);
  await page.getByRole('button',{name:'Hoàn tác'}).click();
  await expect(page.getByRole('button',{name:'Xóa clip'})).toHaveCount(1);
  await page.getByRole('button',{name:'Làm lại'}).click();
  await expect(page.getByRole('button',{name:'Xóa clip'})).toHaveCount(2);
  await expect(page.getByText('Đã lưu trên máy')).toBeVisible({timeout:15000});
  await page.reload();
  await expect(page.getByRole('button',{name:'Xóa clip'})).toHaveCount(2,{timeout:20000});
});

test('output clip speed changes MP4 running time',async({page},info)=>{
  fs.mkdirSync(info.outputDir,{recursive:true});
  const original=path.join(info.outputDir,'speed.mp4');
  execFileSync('ffmpeg',['-y','-f','lavfi','-i','color=c=yellow:s=320x240:r=15','-f','lavfi','-i','sine=frequency=500:sample_rate=44100','-t','1.8','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',original],{stdio:'pipe'});
  await page.goto('/video-editor');
  await page.locator('input[type="file"][accept="video/*"]').setInputFiles(original);
  await page.getByRole('combobox',{name:'Tốc độ clip'}).selectOption('2');
  const saving=page.waitForEvent('download',{timeout:220000});
  await page.getByRole('button',{name:'Xuất video'}).click();
  const download=await saving;
  const output=path.join(info.outputDir,'speed-output.mp4');
  await download.saveAs(output);
  const seconds=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',output],{encoding:'utf8'}).trim());
  expect(seconds).toBeGreaterThan(0.5);
  expect(seconds).toBeLessThan(1.4);
  await info.attach('speed-export',{path:output,contentType:'video/mp4'});
});
