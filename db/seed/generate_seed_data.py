#!/usr/bin/env python3
"""
CineBook | db/seed/generate_seed_data.py   (Step 2 of the build plan)

Fills an EMPTY CineBook database with realistic fake data (5,000+ rows).

How it works
  1. Reference data is inserted directly, in dependency order:
        users -> cities -> venues -> screens -> seats -> movies
        -> shows -> show prices -> coupons
  2. Bookings are NOT inserted directly. They are created through
        sp_create_booking / sp_confirm_booking / sp_cancel_booking /
        sp_record_failed_payment / sp_expire_holds
     so every trigger, constraint and business rule is exercised.
  3. Because those procedures stamp every row with now(), a final pass
     back-dates booked_at, payment.paid_at and the audit log so the monthly
     revenue and peak-hours dashboards have history to show.
     (No trigger fires on those columns, see 03_triggers.sql.)
  4. Bookings for shows that already started need the bypass setting
     cinebook.allow_past_booking (see 05_views_indexes.sql); it is switched
     on per transaction only for those.

Usage
    pip install -r db/seed/requirements.txt
    python db/seed/generate_seed_data.py            # database must be empty
    python db/seed/generate_seed_data.py --reset    # wipe all data first

Connection (environment variables, defaults match docker-compose.yml)
    POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres POSTGRES_DB=cinebook

Demo logins (every account uses the same password):
    admin@cinebook.test | manager1@cinebook.test .. manager10@cinebook.test
    customer1@cinebook.test .. customer40@cinebook.test
    password: Password@123
"""
import argparse
import os
import random
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import bcrypt
import psycopg2
from faker import Faker
from psycopg2 import errors
from psycopg2.extras import execute_values

IST = ZoneInfo("Asia/Kolkata")
DEMO_PASSWORD = "Password@123"
SEED = 42

N_MANAGERS = 10          # one per venue
N_CUSTOMERS = 40
SCREENS_PER_VENUE = [3, 2, 3, 2, 3, 2, 3, 2, 3, 2]   # = 25 screens
SHOWS_PER_SCREEN_PAST = 7
SHOWS_PER_SCREEN_FUTURE = 5
SLOTS_IST = [(10, 0), (13, 30), (17, 0), (20, 30)]  # 3.5h apart > longest show + gap
CLEANING_GAP_MIN = 15

CITIES = [
    ("Hyderabad", "Telangana"), ("Mumbai", "Maharashtra"), ("Delhi", "Delhi"),
    ("Bengaluru", "Karnataka"), ("Chennai", "Tamil Nadu"),
]
VENUE_NAMES = [  # two per city, same order as CITIES
    "Cineplex Gachibowli", "Starlight Banjara Hills",
    "Galaxy Andheri", "Regal Bandra",
    "Silver Screen Saket", "Royal Connaught Place",
    "Orion Whitefield", "Grand Indiranagar",
    "Marina Cinemas T Nagar", "Lumiere Adyar",
]
MOVIES = [  # title, minutes, language, genre
    ("Midnight Express", 138, "Hindi", "Thriller"),
    ("The Last Monsoon", 125, "Hindi", "Drama"),
    ("Iron Veil", 152, "English", "Action"),
    ("Paper Moons", 110, "English", "Romance"),
    ("Dhoom Street", 145, "Hindi", "Action"),
    ("Neon Harbour", 128, "English", "Sci-Fi"),
    ("Aadhavan Returns", 160, "Tamil", "Action"),
    ("Kaveri Nights", 132, "Tamil", "Drama"),
    ("Vajra", 150, "Telugu", "Action"),
    ("Sitaara", 122, "Telugu", "Romance"),
    ("Kantara Hills", 142, "Kannada", "Fantasy"),
    ("Bengaluru Blues", 118, "Kannada", "Comedy"),
    ("Laugh Riot", 105, "Hindi", "Comedy"),
    ("The Quiet Orbit", 135, "English", "Sci-Fi"),
    ("Shadow Ledger", 126, "English", "Crime"),
    ("Chaand Raat", 115, "Hindi", "Romance"),
    ("Tiger Trail", 148, "Hindi", "Adventure"),
    ("Little Lanterns", 95, "English", "Animation"),
    ("Mass Maharaj", 155, "Telugu", "Action"),
    ("Veera Kadhai", 140, "Tamil", "Historical"),
]
# base price (rupees) range per seat category
PRICE_RANGE = {"REGULAR": (150, 250), "PREMIUM": (260, 400), "RECLINER": (450, 700)}
# relative chance a booking is made in each hour of the day (IST): quiet at night,
# lunchtime bump, strong evening peak -> a believable "peak hours" dashboard
HOUR_WEIGHTS = [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 8, 10, 9, 7, 6, 7, 9, 12, 15, 16, 14, 8, 3]
PAYMENT_METHODS = ["UPI", "UPI", "UPI", "CARD", "CARD", "NETBANKING", "WALLET"]


# ----------------------------------------------------------------------------
def connect():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        dbname=os.getenv("POSTGRES_DB", "cinebook"),
    )


def seat_layout():
    """Rows A.. with 10 seats each. Front rows REGULAR, middle PREMIUM, last row RECLINER."""
    n_rows = random.choice([7, 8, 9])
    rows = "ABCDEFGHI"[:n_rows]
    seats = []
    for i, r in enumerate(rows):
        if i == n_rows - 1:
            cat = "RECLINER"
        elif i >= n_rows - 3:
            cat = "PREMIUM"
        else:
            cat = "REGULAR"
        for n in range(1, 11):
            seats.append((f"{r}{n}", cat))
    return seats


def insert_reference_data(cur, fake):
    pw_hash = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt(rounds=10)).decode()

    # ---- users ------------------------------------------------------------
    users = [("Admin User", "admin@cinebook.test", fake.phone_number(), pw_hash, "ADMIN")]
    for i in range(1, N_MANAGERS + 1):
        users.append((fake.name(), f"manager{i}@cinebook.test", fake.phone_number(), pw_hash, "MANAGER"))
    for i in range(1, N_CUSTOMERS + 1):
        users.append((fake.name(), f"customer{i}@cinebook.test", fake.phone_number(), pw_hash, "CUSTOMER"))
    execute_values(cur, "INSERT INTO APP_USER (name,email,phone,password_hash,role) VALUES %s", users)
    cur.execute("SELECT user_id, role FROM APP_USER ORDER BY user_id")
    rows = cur.fetchall()
    manager_ids = [u for u, r in rows if r == "MANAGER"]
    customer_ids = [u for u, r in rows if r == "CUSTOMER"]

    # ---- cities, venues ---------------------------------------------------
    execute_values(cur, "INSERT INTO CITY (name,state) VALUES %s", CITIES)
    cur.execute("SELECT city_id FROM CITY ORDER BY city_id")
    city_ids = [r[0] for r in cur.fetchall()]
    venues = []
    for i, name in enumerate(VENUE_NAMES):
        venues.append((name, f"{fake.street_address()}, {CITIES[i // 2][0]}",
                       city_ids[i // 2], manager_ids[i]))
    execute_values(cur, "INSERT INTO VENUE (name,address,city_id,manager_id) VALUES %s", venues)
    cur.execute("SELECT venue_id FROM VENUE ORDER BY venue_id")
    venue_ids = [r[0] for r in cur.fetchall()]

    # ---- screens, seats ---------------------------------------------------
    screens = []
    for vid, n in zip(venue_ids, SCREENS_PER_VENUE):
        for s in range(1, n + 1):
            screens.append((vid, f"Screen {s}"))
    execute_values(cur, "INSERT INTO SCREEN (venue_id,screen_name) VALUES %s", screens)
    cur.execute("SELECT screen_id FROM SCREEN ORDER BY screen_id")
    screen_ids = [r[0] for r in cur.fetchall()]
    seat_rows, screen_cats = [], {}
    for sid in screen_ids:
        layout = seat_layout()
        screen_cats[sid] = sorted({c for _, c in layout})
        seat_rows += [(sid, no, cat) for no, cat in layout]
    execute_values(cur, "INSERT INTO SEAT (screen_id,seat_no,category) VALUES %s", seat_rows)

    # ---- movies -----------------------------------------------------------
    movie_rows = [(t, d, lang, g, fake.date_between("-90d", "-1d")) for t, d, lang, g in MOVIES]
    execute_values(cur, "INSERT INTO MOVIE (title,duration_min,language,genre,release_date) VALUES %s", movie_rows)
    cur.execute("SELECT movie_id, duration_min FROM MOVIE ORDER BY movie_id")
    movies = cur.fetchall()   # [(id, minutes)], index = popularity rank

    # ---- coupons ----------------------------------------------------------
    cur.execute("SELECT now()")
    now = cur.fetchone()[0]
    coupons = [
        ("WELCOME10", "PERCENT", 10, None, None),
        ("FLAT50", "FLAT", 50, None, None),
        ("FESTIVAL15", "PERCENT", 15, now + timedelta(days=60), 100),
        ("BIGSAVER", "PERCENT", 25, now + timedelta(days=60), 5),     # limited: 5 uses
        ("EXPIRED20", "PERCENT", 20, now - timedelta(days=10), None),  # for the W3 expired-coupon test
    ]
    execute_values(cur, "INSERT INTO COUPON (code,discount_type,discount_value,valid_to,max_uses) VALUES %s", coupons)

    # ---- shows + prices ---------------------------------------------------
    # Each screen is filled with distinct (day, slot) pairs, so no two shows
    # on a screen can overlap (R3). Slots are 3.5h apart; the longest show
    # (160 min) + 15 min cleaning gap is < 3.5h.
    today_ist = now.astimezone(IST).date()
    show_defs = []   # (movie_id, screen_id, start, end)
    for sid in screen_ids:
        used = set()
        for days_range, count in (((-30, -1), SHOWS_PER_SCREEN_PAST), ((1, 8), SHOWS_PER_SCREEN_FUTURE)):
            made = 0
            while made < count:
                key = (random.randint(*days_range), random.randrange(len(SLOTS_IST)))
                if key in used:
                    continue
                used.add(key)
                day, slot = key
                h, m = SLOTS_IST[slot]
                start = datetime.combine(today_ist + timedelta(days=day), datetime.min.time(),
                                         tzinfo=IST).replace(hour=h, minute=m)
                mid, dur = random.choice(movies)
                end = start + timedelta(minutes=dur + CLEANING_GAP_MIN)
                show_defs.append((mid, sid, start, end))
                made += 1
    execute_values(cur, "INSERT INTO MOVIE_SHOW (movie_id,screen_id,start_time,end_time) VALUES %s",
                   show_defs)
    cur.execute("SELECT show_id, movie_id, screen_id, start_time FROM MOVIE_SHOW ORDER BY show_id")
    shows = cur.fetchall()

    # every category on the screen needs a price, or sp_create_booking raises "No price set"
    price_rows = []
    for show_id, _, sid, _ in shows:
        for cat in screen_cats[sid]:
            lo, hi = PRICE_RANGE[cat]
            price_rows.append((show_id, cat, random.randrange(lo, hi + 1, 10)))
    execute_values(cur, "INSERT INTO SHOW_PRICE (show_id,category,price) VALUES %s", price_rows)

    return {
        "now": now, "customers": customer_ids, "shows": shows, "movies": movies,
    }


# ----------------------------------------------------------------------------
class Booker:
    """Creates bookings through the stored procedures and remembers which seats are taken."""

    def __init__(self, conn, ctx):
        self.conn = conn
        self.cur = conn.cursor()
        self.now = ctx["now"]
        self.customers = ctx["customers"]
        self.shows = ctx["shows"]
        popularity = {m[0]: 1.0 / (i + 1) ** 0.8 for i, m in enumerate(ctx["movies"])}
        self.weights = [popularity[s[1]] for s in self.shows]
        self.past = [s for s in self.shows if s[3] <= self.now]
        self.future = [s for s in self.shows if s[3] > self.now]
        # shows starting 2h-24h from now: cancelling these gives the 50% refund tier
        self.soon = [s for s in self.future
                     if timedelta(hours=2) <= s[3] - self.now < timedelta(hours=24)]
        self.seats_of_screen = {}
        self.taken = defaultdict(set)         # show_id -> seat_no currently active
        self.records = []                     # one dict per booking, used for back-dating
        self.skipped = 0

    # -- helpers --
    def screen_seats(self, screen_id):
        if screen_id not in self.seats_of_screen:
            self.cur.execute("SELECT seat_no FROM SEAT WHERE screen_id=%s ORDER BY seat_no", (screen_id,))
            self.seats_of_screen[screen_id] = [r[0] for r in self.cur.fetchall()]
        return self.seats_of_screen[screen_id]

    def pick_show(self, pool):
        w = [self.weights[self.shows.index(s)] for s in pool]
        return random.choices(pool, weights=w)[0]

    def pick_seats(self, show):
        show_id, _, screen_id, _ = show
        free = [s for s in self.screen_seats(screen_id) if s not in self.taken[show_id]]
        k = random.choices([1, 2, 3, 4, 5, 6], weights=[20, 35, 15, 15, 8, 7])[0]
        if len(free) < k:
            return None
        # prefer k neighbouring seats in one row, like a real customer
        by_row = defaultdict(list)
        for s in free:
            by_row[s[0]].append(s)
        rows = list(by_row.values())
        random.shuffle(rows)
        for r in rows:
            nums = sorted(r, key=lambda x: int(x[1:]))
            for i in range(len(nums) - k + 1):
                block = nums[i:i + k]
                if int(block[-1][1:]) - int(block[0][1:]) == k - 1:
                    return block
        return random.sample(free, k)

    def create(self, show, user, seats, coupon):
        """CALL sp_create_booking in its own transaction. Returns booking_id or None."""
        is_past = show[3] <= self.now
        try:
            self.cur.execute("SELECT set_config('cinebook.allow_past_booking', %s, true)",
                             ("on" if is_past else "off",))
            self.cur.execute("CALL sp_create_booking(%s, %s, %s, %s, NULL)",
                             (user, show[0], seats, coupon))
            bid = self.cur.fetchone()[0]
            self.conn.commit()
        except (errors.RaiseException, errors.UniqueViolation):
            self.conn.rollback()
            return None
        self.taken[show[0]].update(seats)
        return bid

    def confirm(self, bid):
        self.cur.execute("CALL sp_confirm_booking(%s, %s, NULL)", (bid, random.choice(PAYMENT_METHODS)))
        self.conn.commit()

    def failed_payment(self, bid):
        self.cur.execute("CALL sp_record_failed_payment(%s, %s, NULL)", (bid, random.choice(PAYMENT_METHODS)))
        self.conn.commit()

    def release(self, show_id, seats):
        self.taken[show_id].difference_update(seats)

    def new_booking(self, pool, coupon_chance=0.25):
        """Pick show/seats/user (and maybe a coupon) and create the HELD booking."""
        for _ in range(30):
            show = self.pick_show(pool)
            seats = self.pick_seats(show)
            if seats is None:
                continue
            user = random.choice(self.customers)
            coupon = None
            if random.random() < coupon_chance:
                coupon = random.choice(["WELCOME10", "WELCOME10", "FLAT50", "FESTIVAL15", "BIGSAVER"])
            bid = self.create(show, user, seats, coupon)
            if bid is None and coupon is not None:       # e.g. BIGSAVER limit reached -> retry plain
                bid = self.create(show, user, seats, None)
            if bid is not None:
                return show, seats, bid
        self.skipped += 1
        return None

    def log(self, bid, show, final):
        self.records.append({"bid": bid, "show": show, "final": final})

    # -- scenarios --
    def confirmed(self, pool, n):
        for _ in range(n):
            r = self.new_booking(pool)
            if r:
                show, seats, bid = r
                self.confirm(bid)
                self.log(bid, show, "CONFIRMED")

    def retry_after_failure(self, pool, n):
        """R7: first payment FAILED, retry creates a NEW payment row and succeeds."""
        for _ in range(n):
            r = self.new_booking(pool)
            if r:
                show, seats, bid = r
                self.failed_payment(bid)
                self.confirm(bid)
                self.log(bid, show, "CONFIRMED")

    def cancelled(self, n):
        for i in range(n):
            pool = self.soon if (self.soon and i % 3 == 0) else self.future
            r = self.new_booking(pool, coupon_chance=0.15)
            if not r:
                continue
            show, seats, bid = r
            self.confirm(bid)
            try:
                self.cur.execute("CALL sp_cancel_booking(%s, NULL)", (bid,))
                self.conn.commit()
            except errors.RaiseException:                # show < 2h away: keep it CONFIRMED
                self.conn.rollback()
                self.log(bid, show, "CONFIRMED")
                continue
            self.release(show[0], seats)
            self.log(bid, show, "CANCELLED")

    def expired(self, n):
        """Hold that was never paid: back-date it 15+ minutes, then let sp_expire_holds sweep it."""
        for _ in range(n):
            r = self.new_booking(self.future, coupon_chance=0.1)
            if not r:
                continue
            show, seats, bid = r
            mins_ago = random.randint(15, 60 * 24 * 20)
            self.cur.execute(
                "UPDATE BOOKING SET booked_at = now() - make_interval(mins => %s), "
                "hold_expires_at = now() - make_interval(mins => %s) + interval '10 minutes' "
                "WHERE booking_id = %s", (mins_ago, mins_ago, bid))
            self.conn.commit()
            self.release(show[0], seats)
            self.log(bid, show, "EXPIRED")
        self.cur.execute("CALL sp_expire_holds(NULL)")
        self.conn.commit()

    def live_holds(self, n):
        """Left HELD (10-minute hold, so it lapses 10 minutes after seeding)."""
        for i in range(n):
            r = self.new_booking(self.future, coupon_chance=0.1)
            if r:
                show, seats, bid = r
                if i % 2 == 0:
                    self.failed_payment(bid)             # a failed attempt, still HELD
                self.log(bid, show, "HELD")


def backdate(conn, records, now):
    """Spread booked_at over the past, and keep payment/audit timestamps consistent."""
    cur = conn.cursor()
    for rec in records:
        if rec["final"] == "EXPIRED":
            cur.execute("SELECT booked_at FROM BOOKING WHERE booking_id=%s", (rec["bid"],))
            booked = cur.fetchone()[0]
        elif rec["final"] == "HELD":
            continue                                      # keep real timestamps: hold must stay live
        else:
            start = rec["show"][3]
            latest = min(start, now) - timedelta(hours=1)
            booked = latest - timedelta(minutes=random.randint(5, 60 * 24 * 25))
            hour = random.choices(range(24), weights=HOUR_WEIGHTS)[0]
            booked = booked.astimezone(IST).replace(hour=hour, minute=random.randint(0, 59),
                                                    second=random.randint(0, 59))
            if booked > latest:                      # keep it before the show / before now
                booked -= timedelta(days=1)
            cur.execute("UPDATE BOOKING SET booked_at=%s, hold_expires_at=%s WHERE booking_id=%s",
                        (booked, booked + timedelta(minutes=10), rec["bid"]))
        confirmed_at = booked + timedelta(minutes=random.randint(1, 8))
        # audit trail
        cur.execute("UPDATE BOOKING_AUDIT SET changed_at=%s WHERE booking_id=%s AND new_status='HELD'",
                    (booked, rec["bid"]))
        cur.execute("UPDATE BOOKING_AUDIT SET changed_at=%s WHERE booking_id=%s AND new_status='EXPIRED'",
                    (booked + timedelta(minutes=10), rec["bid"]))
        cur.execute("UPDATE BOOKING_AUDIT SET changed_at=%s WHERE booking_id=%s AND new_status='CONFIRMED'",
                    (confirmed_at, rec["bid"]))
        if rec["final"] == "CANCELLED":
            cancelled_at = min(now, confirmed_at + timedelta(hours=random.randint(1, 72)))
            cur.execute("UPDATE BOOKING_AUDIT SET changed_at=%s WHERE booking_id=%s AND new_status='CANCELLED'",
                        (cancelled_at, rec["bid"]))
        # payments (the FAILED attempt, if any, happened just before success)
        cur.execute("UPDATE PAYMENT SET paid_at=%s WHERE booking_id=%s AND status IN ('SUCCESS','REFUNDED')",
                    (confirmed_at, rec["bid"]))
    conn.commit()


def report(cur):
    print("\nRow counts")
    total = 0
    for t in ["APP_USER", "CITY", "VENUE", "SCREEN", "SEAT", "MOVIE", "MOVIE_SHOW", "SHOW_PRICE",
              "COUPON", "BOOKING", "BOOKING_SEAT", "PAYMENT", "BOOKING_AUDIT"]:
        cur.execute(f"SELECT count(*) FROM {t}")
        n = cur.fetchone()[0]
        total += n
        print(f"  {t:<14}{n:>7}")
    print(f"  {'TOTAL':<14}{total:>7}")
    cur.execute("SELECT status, count(*) FROM BOOKING GROUP BY 1 ORDER BY 1")
    print("Bookings by status:", dict(cur.fetchall()))
    cur.execute("SELECT status, count(*) FROM PAYMENT GROUP BY 1 ORDER BY 1")
    print("Payments by status:", dict(cur.fetchall()))
    cur.execute("SELECT count(*) FROM BOOKING WHERE coupon_id IS NOT NULL")
    print("Bookings with a coupon:", cur.fetchone()[0])


def main():
    ap = argparse.ArgumentParser(description="Seed the CineBook database.")
    ap.add_argument("--reset", action="store_true", help="delete ALL existing data first")
    args = ap.parse_args()

    random.seed(SEED)
    fake = Faker("en_IN")
    Faker.seed(SEED)

    conn = connect()
    cur = conn.cursor()
    if args.reset:
        cur.execute("TRUNCATE APP_USER, CITY, VENUE, SCREEN, SEAT, MOVIE, MOVIE_SHOW, SHOW_PRICE, "
                    "COUPON, BOOKING, BOOKING_SEAT, PAYMENT, BOOKING_AUDIT RESTART IDENTITY CASCADE")
        conn.commit()
        print("Existing data deleted.")
    cur.execute("SELECT count(*) FROM APP_USER")
    if cur.fetchone()[0] > 0:
        sys.exit("Database already has data. Re-run with --reset to wipe it first.")

    print("Inserting reference data ...")
    ctx = insert_reference_data(cur, fake)
    conn.commit()

    print("Creating bookings through the stored procedures ...")
    b = Booker(conn, ctx)
    b.confirmed(b.past, 700)              # history for revenue / peak-hours / top-movies
    b.confirmed(b.future, 150)            # upcoming shows, some with coupons
    b.retry_after_failure(b.past, 30)     # FAILED payment, then success (R7)
    b.retry_after_failure(b.future, 20)
    b.cancelled(60)                       # 100% and 50% refunds, seats freed
    b.expired(20)                         # abandoned holds
    b.live_holds(8)                       # still HELD right now

    print("Back-dating timestamps ...")
    backdate(conn, b.records, ctx["now"])
    b.cur.execute("SELECT 1")             # keep the same connection alive

    report(conn.cursor())
    if b.skipped:
        print(f"(note: {b.skipped} booking attempts skipped because no free seats were found)")
    conn.close()
    print("\nDone. Demo login: admin@cinebook.test / Password@123")


if __name__ == "__main__":
    main()
