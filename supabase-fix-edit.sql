-- ============================================================
-- KULLANICININ KENDİ BİLDİRİSİNİ DÜZENLEMESİ
-- ------------------------------------------------------------
-- Amaç: Bildiri sahibi, son başvuru tarihine kadar bildirisini
--   düzenleyebilsin. Güvenlik: e-posta + bildiri ID eşleşmesi
--   + status='pending' + submissions_open=true kontrolü
--   sunucu tarafında yapılır.
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → New query →
--   bu dosyanın TÜMÜNÜ yapıştır → Run.
-- ============================================================

create or replace function public.user_update_submission(
  p_id text,
  p_email text,
  p_payload jsonb
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_row submissions%rowtype;
begin
  -- 1) Başvuru süresi açık mı?
  select submissions_open into v_open from settings where id = 1;
  if v_open is null then v_open := true; end if;
  if not v_open then
    raise exception 'BAŞVURU_KAPALI: Başvuru süresi sona ermiştir.';
  end if;

  -- 2) Bildiriyi e-posta eşleşmesiyle bul (case-insensitive)
  select * into v_row from submissions
   where id = p_id
     and lower(coalesce(contact_email, '')) = lower(coalesce(p_email, ''));

  if not found then
    raise exception 'BULUNAMADI: Bu numara ve e-posta ile bir bildiri bulunamadı.';
  end if;

  -- 3) Sadece beklemedeki bildiriler düzenlenebilir
  if v_row.status <> 'pending' then
    raise exception 'KILITLI: Bu bildiri "%" durumunda; düzenlenemez.', v_row.status;
  end if;

  -- 4) Güncelle (sadece sağlanan alanları)
  update submissions set
    title = coalesce(p_payload->>'title', title),
    abstract = coalesce(p_payload->>'abstract', abstract),
    keywords = case
      when p_payload ? 'keywords'
      then array(select jsonb_array_elements_text(p_payload->'keywords'))
      else keywords
    end,
    authors = coalesce(p_payload->'authors', authors),
    affiliations = case
      when p_payload ? 'affiliations'
      then array(select jsonb_array_elements_text(p_payload->'affiliations'))
      else affiliations
    end,
    contact_name = coalesce(p_payload->>'contact_name', contact_name),
    contact_email = coalesce(p_payload->>'contact_email', contact_email),
    contact_phone = coalesce(p_payload->>'contact_phone', contact_phone),
    contact_inst = coalesce(p_payload->>'contact_inst', contact_inst),
    ethics_ack = coalesce((p_payload->>'ethics_ack')::boolean, ethics_ack),
    originality_ack = coalesce((p_payload->>'originality_ack')::boolean, originality_ack)
  where id = p_id
  returning * into v_row;

  -- 5) Audit log
  insert into audit_log (action, target, actor, extra)
  values ('user_edit', p_id, p_email, 'kullanıcı kendi bildirisini düzenledi');

  return row_to_json(v_row);
end $$;

-- Anon ve authenticated kullanıcılar bu fonksiyonu çalıştırabilir
grant execute on function public.user_update_submission(text, text, jsonb) to anon, authenticated;

-- DOĞRULAMA
select 'user_update_submission RPC kuruldu ✓' as durum;
