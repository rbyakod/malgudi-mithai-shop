FROM mongo:7

# Replica-set internal auth. mongod refuses "--replSet" + root credentials
# without a shared keyFile ("security.keyFile is required when
# authorization is enabled with replica sets"). Generated at build time so
# no host-permission dance for the bind mount; dev-only shared secret.
RUN openssl rand -base64 756 > /etc/mongo-keyfile \
  && chmod 400 /etc/mongo-keyfile \
  && chown mongodb:mongodb /etc/mongo-keyfile
