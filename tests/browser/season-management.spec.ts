import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
const databaseUrl=process.env.TEST_DATABASE_URL??'postgres://lab:lab_local@127.0.0.1:55433/lab_test';
if(!new URL(databaseUrl).pathname.endsWith('_test'))throw new Error('Dedicated test database required');
const pool=new Pool({connectionString:databaseUrl});
test.beforeAll(async()=>{await migrate(drizzle(pool),{migrationsFolder:'./database/migrations'});});
test.beforeEach(async()=>{await pool.query('DELETE FROM seasons');await pool.query('DELETE FROM activities');await pool.query('DELETE FROM rate_limits');});
test.afterAll(async()=>{await pool.end();});
test('Ops manage Seasons and an owner continues a Project with real history visible in both languages',async({page,browser})=>{
 const email=`season-${randomUUID()}@gso.schule.koeln`;
 await page.goto('/login');await page.getByLabel('Name',{exact:true}).fill('Season Ops');await page.getByLabel('Schul-E-Mail').fill(email);
 await page.getByRole('button',{name:'Login-Link senden'}).click();await expect(page.getByRole('status')).toContainText('Postfach');
 const box=await page.request.get(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r=>r.json());
 const mail=await page.request.get(`http://127.0.0.1:8025/api/v1/message/${box.messages[0].ID}`).then(r=>r.json());await page.goto(mail.Text.match(/https?:\/\/\S+/)[0]);
 await pool.query("UPDATE users SET role='OPS' WHERE email=$1",[email]);
 await page.goto('/ops');await page.getByRole('link',{name:'Seasons verwalten',exact:true}).click();
 async function create(number:number,title:string){
  await page.getByText('Season erstellen',{exact:true}).click();const form=page.getByRole('form',{name:'Season erstellen'});
  await form.getByLabel('Nummer',{exact:true}).fill(String(number));await form.getByLabel('Titel',{exact:true}).fill(title);
  await form.getByLabel('Beginn',{exact:true}).fill('2027-03-01');await form.getByLabel('Ende',{exact:true}).fill('2027-04-30');await form.getByLabel('Status',{exact:true}).selectOption('ACTIVE');
  await form.getByRole('button',{name:'Season speichern'}).click();await expect(page.getByRole('heading',{name:`Season ${number} · ${title}`,exact:true})).toBeVisible();
 }
 await create(0,'First builders');
 const project=(await page.request.post('/api/projects',{headers:{origin:'http://127.0.0.1:5173'},data:{title:'Continuous build',description:'Keep building',goal:'Across seasons'}}).then(r=>r.json())).project;
 await page.goto(`/projects/${project.id}`);await expect(page.getByLabel('Season auswählen',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Season 0',exact:true})).toBeVisible();
 await page.goto('/ops/seasons');await page.getByText('Season bearbeiten',{exact:true}).click();const edit=page.getByRole('form',{name:'Season bearbeiten'});
 await edit.getByLabel('Status',{exact:true}).selectOption('FINISHED');await edit.getByRole('button',{name:'Season speichern'}).click();await expect(page.getByRole('article').getByText('Beendet',{exact:true}).first()).toBeVisible();
 await create(2,'Next builders');await page.goto(`/projects/${project.id}`);
 await expect(page.getByRole('link',{name:'Season 0',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Season 1',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Season 2',exact:true}).click();await expect(page.getByRole('heading',{name:'Continuous build',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'English'}).click();await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
 const context=await browser.newContext({viewport:{width:390,height:844}});try{const visitor=await context.newPage();await visitor.goto('/home');await expect(visitor.getByRole('heading',{name:'Next builders'})).toBeVisible();await expect(visitor.getByRole('heading',{name:'Continuous build'})).toBeVisible();expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}finally{await context.close();}
});
