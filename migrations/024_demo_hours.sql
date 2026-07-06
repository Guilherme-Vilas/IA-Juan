-- Demo: expediente comercial (a 023 criou 0h-24h e o agendamento chegou a
-- propor 00h30 na demonstração). Horários agora só entre 9h e 18h.

UPDATE tenants
   SET work_start_hour = 9,
       work_end_hour = 18
 WHERE slug = 'demo';
