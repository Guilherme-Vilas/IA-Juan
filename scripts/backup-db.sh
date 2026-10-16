#!/bin/sh
# Backup diário do Postgres (roda no serviço db-backup do compose).
# Dump comprimido de TODOS os bancos (ia_juan + evolution), retenção local de
# N dias. O volume pg-backups deve ser copiado pra fora do servidor (rclone,
# restic, snapshot do provedor) — backup no mesmo disco protege de "DROP TABLE",
# não de disco morto.
set -eu

: "${PGHOST:=postgres}"
: "${PGUSER:=ia}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

mkdir -p "$BACKUP_DIR"

while true; do
  STAMP=$(date -u +%Y%m%d-%H%M%S)
  FILE="$BACKUP_DIR/pg-$STAMP.sql.gz"
  echo "[backup] iniciando dump -> $FILE"
  if pg_dumpall -h "$PGHOST" -U "$PGUSER" --clean --if-exists | gzip > "$FILE.tmp"; then
    mv "$FILE.tmp" "$FILE"
    SIZE=$(du -h "$FILE" | cut -f1)
    echo "[backup] ok: $FILE ($SIZE)"
  else
    rm -f "$FILE.tmp"
    echo "[backup] ERRO: pg_dumpall falhou" >&2
  fi

  # retenção: apaga dumps mais velhos que N dias
  find "$BACKUP_DIR" -name 'pg-*.sql.gz' -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

  echo "[backup] próximo em ${BACKUP_INTERVAL_SECONDS}s"
  sleep "$BACKUP_INTERVAL_SECONDS"
done
