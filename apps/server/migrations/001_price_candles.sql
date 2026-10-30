 CREATE TABLE IF NOT EXISTS  public.price_candles (
        token text NOT NULL,
        interval_sec integer NOT NULL CHECK (interval_sec IN (1, 60, 300, 900, 3600)),
        bucket_start timestamptz NOT NULL,
        open double precision NOT NULL,
        high double precision NOT NULL,
        low double precision NOT NULL,
        close double precision NOT NULL,
        PRIMARY KEY (token, interval_sec, bucket_start)
);