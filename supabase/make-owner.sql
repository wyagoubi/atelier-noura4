-- شغّليه في Supabase > SQL Editor بعد تشغيل ملف قاعدة البيانات الخاص بك.
-- بدّلي البريد ببريد حساب المالك (يجب أن يكون الحساب موجودًا في Authentication > Users).
insert into public.profiles (id, role)
select id, 'owner' from auth.users where email = 'PUT_OWNER_EMAIL_HERE'
on conflict (id) do update set role = 'owner';
