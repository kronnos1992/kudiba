FROM postgres:16-alpine

ENV KUDIBA_SQL_DIR=/docker-entrypoint-initdb.d \
    KUDIBA_RUNTIME_SQL_DIR=/opt/kudiba

COPY . /docker-entrypoint-initdb.d
COPY 16-row-level-security.sql 17-application-role.sql /opt/kudiba/

RUN chmod +x /docker-entrypoint-initdb.d/00-init-databases.sh \
    /docker-entrypoint-initdb.d/db-init-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint-initdb.d/db-init-entrypoint.sh"]
