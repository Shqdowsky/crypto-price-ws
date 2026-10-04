--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1
-- Dumped by pg_dump version 16.1

-- Started on 2026-10-04 12:12:27
--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

--
-- TOC entry 4934 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 33169)
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    quantity numeric(20,8) DEFAULT 0 NOT NULL,
    avg_cost_basis numeric(20,8) DEFAULT 0 NOT NULL,
    total_bought numeric(20,8) DEFAULT 0 NOT NULL,
    total_sold numeric(20,8) DEFAULT 0 NOT NULL,
    running_sell_total numeric(20,8) DEFAULT 0 NOT NULL,
    avg_sell_price numeric(20,8),
    realized_pnl numeric(20,2),
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT closed_has_close_fields CHECK ((((status = 'open'::text) AND (closed_at IS NULL)) OR ((status = 'closed'::text) AND (closed_at IS NOT NULL) AND (avg_sell_price IS NOT NULL) AND (realized_pnl IS NOT NULL)))),
    CONSTRAINT positions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text]))),
    CONSTRAINT quantity_non_negative CHECK ((quantity >= (0)::numeric))
);


--
-- TOC entry 222 (class 1259 OID 33168)
-- Name: positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4935 (class 0 OID 0)
-- Dependencies: 222
-- Name: positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


--
-- TOC entry 220 (class 1259 OID 24992)
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    family_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- TOC entry 219 (class 1259 OID 24912)
-- Name: trades; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trades (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(20) NOT NULL,
    side character varying(4) NOT NULL,
    price numeric(18,8) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    position_id integer NOT NULL,
    quantity numeric(20,8) DEFAULT 1 NOT NULL,
    CONSTRAINT trades_side_check CHECK (((side)::text = ANY ((ARRAY['buy'::character varying, 'sell'::character varying])::text[])))
);
--
-- TOC entry 218 (class 1259 OID 24911)
-- Name: trades_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4936 (class 0 OID 0)
-- Dependencies: 218
-- Name: trades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


--
-- TOC entry 221 (class 1259 OID 33154)
-- Name: user_room_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_room_subscriptions (
    user_id integer NOT NULL,
    room text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 217 (class 1259 OID 24904)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    balance numeric(20,2) DEFAULT 1000.00 NOT NULL
);

--
-- TOC entry 216 (class 1259 OID 24903)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- TOC entry 4937 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


--
-- TOC entry 4752 (class 2604 OID 33172)
-- Name: positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq'::regclass);


--
-- TOC entry 4746 (class 2604 OID 24915)
-- Name: trades id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades ALTER COLUMN id SET DEFAULT nextval('public.trades_id_seq'::regclass);


--
-- TOC entry 4743 (class 2604 OID 24907)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4780 (class 2606 OID 33186)
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- TOC entry 4774 (class 2606 OID 25000)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4770 (class 2606 OID 24919)
-- Name: trades trades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_pkey PRIMARY KEY (id);


--
-- TOC entry 4776 (class 2606 OID 33161)
-- Name: user_room_subscriptions user_room_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_room_subscriptions
    ADD CONSTRAINT user_room_subscriptions_pkey PRIMARY KEY (user_id, room);


--
-- TOC entry 4765 (class 2606 OID 24926)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4767 (class 2606 OID 24910)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4777 (class 1259 OID 33193)
-- Name: idx_positions_user_closed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_user_closed ON public.positions USING btree (user_id, closed_at DESC) WHERE (status = 'closed'::text);


--
-- TOC entry 4771 (class 1259 OID 25007)
-- Name: idx_refresh_tokens_family_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_family_id ON public.refresh_tokens USING btree (family_id);


--
-- TOC entry 4772 (class 1259 OID 25006)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 4768 (class 1259 OID 33202)
-- Name: idx_trades_position_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trades_position_id ON public.trades USING btree (position_id);


--
-- TOC entry 4778 (class 1259 OID 33192)
-- Name: one_open_position_per_user_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_open_position_per_user_token ON public.positions USING btree (user_id, token) WHERE (status = 'open'::text);


--
-- TOC entry 4785 (class 2606 OID 33187)
-- Name: positions positions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4783 (class 2606 OID 25001)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4781 (class 2606 OID 33197)
-- Name: trades trades_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id);


--
-- TOC entry 4782 (class 2606 OID 24920)
-- Name: trades trades_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4784 (class 2606 OID 33162)
-- Name: user_room_subscriptions user_room_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_room_subscriptions
    ADD CONSTRAINT user_room_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-10-04 12:12:27

--
-- PostgreSQL database dump complete
--

