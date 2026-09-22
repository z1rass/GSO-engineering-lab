import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
const databaseUrl=process.env.TEST_DATABASE_URL??'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if(!new URL(databaseUrl).pathname.endsWith('_test'))throw new Error('Dedicated test database required');
const pool=new Pool({connectionString:databaseUrl});
test.beforeAll(async()=>{await migrate(drizzle(pool),{migrationsFolder:'./database/migrations'});});
test.beforeEach(async()=>{await pool.query('DELETE FROM activities');await pool.query('DELETE FROM rate_limits');});
test.afterAll(async()=>{await pool.end();});
async function login(page:Page,name:string){
 const email=`transfer-${randomUUID()}@gso.schule.koeln`;
 await page.goto('/login');await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Schul-E-Mail').fill(email);
 await page.getByRole('button',{name:'Login-Link senden'}).click();await expect(page.getByRole('status')).toContainText('Postfach');
 const box=await page.request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r=>r.json());
 const mail=await page.request.get(`http://127.0.0.1:8025/api/v1/message/${box.messages[0].ID}`).then(r=>r.json());
 await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
}
test('Owner proposes, successor accepts in EN, and both pages show the changed responsibility and permissions',async({page,browser})=>{
 const successorName=`Next owner ${randomUUID().slice(0,8)}`;
 await login(page,'Original owner');
 const context=await browser.newContext({viewport:{width:390,height:844}});const next=await context.newPage();
 try{
  await login(next,successorName);
  const created=await page.request.post('/api/projects',{headers:{origin:'http://127.0.0.1:5173'},data:{title:'Ownership project',goal:'Build together',description:'Hand over the Lab'}});
  const id=(await created.json()).project.id;await page.goto(`/projects/${id}`);
  await page.getByText('Verantwortung übertragen',{exact:true}).click();
  await page.getByLabel('Neuer Owner',{exact:true}).selectOption({label:successorName});
  await page.getByRole('button',{name:'Übergabe vorschlagen',exact:true}).click();
  await expect(page.getByText('Wartet auf Annahme',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Projekt bearbeiten',exact:true})).toBeVisible();
  await next.goto(`/projects/${id}`);await next.getByRole('button',{name:'English'}).click();
  await next.getByRole('button',{name:'Accept ownership',exact:true}).click();
  await expect(next.getByRole('link',{name:'Edit project',exact:true})).toBeVisible();
  await expect(next.locator('.project-owner').first()).toContainText(successorName);
  expect(await next.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.getByRole('link',{name:'Projekt bearbeiten',exact:true})).toHaveCount(0);
  await expect(page.locator('.project-owner').first()).toContainText(successorName);
 }finally{await context.close();}
});
