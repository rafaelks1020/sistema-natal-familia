// O alias p representa o participante atual, tanto na listagem quanto no vínculo.
export const discardableParticipant = `(
  NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.participant_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM secret_santa_draws d WHERE d.giver_id = p.id OR d.receiver_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM wish_list w WHERE w.participant_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM family_attendance a WHERE a.participant_id = p.id)
)`;
