--
-- PostgreSQL database dump
--

-- Dumped from database version 16.1
-- Dumped by pg_dump version 16.1

-- Started on 2026-10-19 01:19:10

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

--
-- TOC entry 4962 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 49562)
-- Name: funding_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.funding_requests (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    amount numeric(20,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reason text,
    reviewed_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT funding_requests_amount_check CHECK (((amount >= (1000)::numeric) AND (amount <= (5000)::numeric))),
    CONSTRAINT funding_requests_check CHECK (((status = 'pending'::text) = (reviewed_at IS NULL))),
    CONSTRAINT funding_requests_check1 CHECK (((status <> 'rejected'::text) OR ((reason IS NOT NULL) AND (length(btrim(reason)) > 0)))),
    CONSTRAINT funding_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);

--
-- TOC entry 225 (class 1259 OID 49561)
-- Name: funding_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.funding_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 4963 (class 0 OID 0)
-- Dependencies: 225
-- Name: funding_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


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
-- TOC entry 4964 (class 0 OID 0)
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
-- TOC entry 4965 (class 0 OID 0)
-- Dependencies: 218
-- Name: trades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


--
-- TOC entry 224 (class 1259 OID 49553)
-- Name: treasury; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.treasury (
    id boolean DEFAULT true NOT NULL,
    balance numeric(20,2) NOT NULL,
    CONSTRAINT treasury_balance_check CHECK ((balance >= (0)::numeric)),
    CONSTRAINT treasury_id_check CHECK (id)
);

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
    balance numeric(20,2) DEFAULT 1000.00 NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT users_role_valid CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
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
-- TOC entry 4966 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--


--
-- TOC entry 4771 (class 2604 OID 49565)
-- Name: funding_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funding_requests ALTER COLUMN id SET DEFAULT nextval('public.funding_requests_id_seq'::regclass);


--
-- TOC entry 4762 (class 2604 OID 33172)
-- Name: positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq'::regclass);


--
-- TOC entry 4756 (class 2604 OID 24915)
-- Name: trades id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades ALTER COLUMN id SET DEFAULT nextval('public.trades_id_seq'::regclass);


--
-- TOC entry 4752 (class 2604 OID 24907)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4806 (class 2606 OID 49575)
-- Name: funding_requests funding_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funding_requests
    ADD CONSTRAINT funding_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4801 (class 2606 OID 33186)
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- TOC entry 4795 (class 2606 OID 25000)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4791 (class 2606 OID 24919)
-- Name: trades trades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_pkey PRIMARY KEY (id);


--
-- TOC entry 4803 (class 2606 OID 49560)
-- Name: treasury treasury_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.treasury
    ADD CONSTRAINT treasury_pkey PRIMARY KEY (id);


--
-- TOC entry 4797 (class 2606 OID 33161)
-- Name: user_room_subscriptions user_room_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_room_subscriptions
    ADD CONSTRAINT user_room_subscriptions_pkey PRIMARY KEY (user_id, room);


--
-- TOC entry 4786 (class 2606 OID 24926)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4788 (class 2606 OID 24910)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4804 (class 1259 OID 49587)
-- Name: funding_one_pending_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX funding_one_pending_per_user ON public.funding_requests USING btree (user_id) WHERE (status = 'pending'::text);


--
-- TOC entry 4798 (class 1259 OID 33193)
-- Name: idx_positions_user_closed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_positions_user_closed ON public.positions USING btree (user_id, closed_at DESC) WHERE (status = 'closed'::text);


--
-- TOC entry 4792 (class 1259 OID 25007)
-- Name: idx_refresh_tokens_family_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_family_id ON public.refresh_tokens USING btree (family_id);


--
-- TOC entry 4793 (class 1259 OID 25006)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 4789 (class 1259 OID 33202)
-- Name: idx_trades_position_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trades_position_id ON public.trades USING btree (position_id);


--
-- TOC entry 4799 (class 1259 OID 33192)
-- Name: one_open_position_per_user_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_open_position_per_user_token ON public.positions USING btree (user_id, token) WHERE (status = 'open'::text);


--
-- TOC entry 4812 (class 2606 OID 49581)
-- Name: funding_requests funding_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funding_requests
    ADD CONSTRAINT funding_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 4813 (class 2606 OID 49576)
-- Name: funding_requests funding_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funding_requests
    ADD CONSTRAINT funding_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4811 (class 2606 OID 33187)
-- Name: positions positions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4809 (class 2606 OID 25001)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4807 (class 2606 OID 33197)
-- Name: trades trades_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id);


--
-- TOC entry 4808 (class 2606 OID 24920)
-- Name: trades trades_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trades
    ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4810 (class 2606 OID 33162)
-- Name: user_room_subscriptions user_room_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_room_subscriptions
    ADD CONSTRAINT user_room_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-10-19 01:19:10

--
-- PostgreSQL database dump complete
--

