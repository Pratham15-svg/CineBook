// Run against a seeded CineBook instance. Creates temporary customer accounts.
const BASE = process.env.API_BASE_URL || 'http://localhost:5050/api';
let passed = 0, failed = 0;
const check = (condition, description) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${description}`);
  condition ? passed++ : failed++;
};
async function request(path, method='GET', body, token) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {}) },
    ...(body ? {body:JSON.stringify(body)} : {})
  });
  let data; try { data = await response.json(); } catch { data = {}; }
  return {status:response.status, data};
}
const run = async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const email = `phase5-${suffix}@example.test`, email2 = `phase5-other-${suffix}@example.test`;
  const password = 'TestPassword@123';
  const reg = await request('/auth/register','POST',{name:'Phase 5 Test',email,password});
  check(reg.status === 201,'Register creates a customer account');
  const login = await request('/auth/login','POST',{email,password});
  const token = login.data.token;
  check(login.status === 200 && !!token,'Login returns a token');
  const otherReg = await request('/auth/register','POST',{name:'Other Test',email:email2,password});
  const otherLogin = await request('/auth/login','POST',{email:email2,password});
  const otherToken = otherLogin.data.token;
  check(otherReg.status === 201 && !!otherToken,'Second customer can authenticate');
  const shows = await request('/shows');
  check(shows.status === 200 && Array.isArray(shows.data.shows) && shows.data.shows.length > 0,'Shows list loads with seeded data');
  const city = await request('/shows?city=Hyderabad');
  check(city.status === 200 && Array.isArray(city.data.shows) && city.data.shows.every(s => s.city_name.toLowerCase().includes('hyderabad')),'City filter returns only Hyderabad');
  let selection;
  for (const show of (shows.data.shows || []).slice(0,100)) {
    const seatMap = await request(`/shows/${show.show_id}/seats`);
    if (seatMap.status === 200 && Array.isArray(seatMap.data.seats)) {
      const available = seatMap.data.seats.find(s => s.status === 'AVAILABLE');
      if (available) { selection = {show, seat:available.seat_no, seatMap}; break; }
    }
  }
  check(!!selection,'Seat map loads with at least one available seat');
  if (selection && token) {
    const {show,seat} = selection;
    const held = await request('/bookings','POST',{showId:show.show_id,seatNumbers:[seat]},token);
    const bookingId = held.data.bookingId;
    check(held.status === 201 && !!bookingId,'Hold seats creates a booking');
    if (bookingId) {
      const map = await request(`/shows/${show.show_id}/seats`);
      check(map.data.seats?.some(s=>s.seat_no===seat && s.status==='HELD'),'Seat changes to HELD');
      const privateBooking = await request(`/bookings/${bookingId}`,'GET',undefined,otherToken);
      check([403,404].includes(privateBooking.status),'Another customer cannot access booking');
      const conflict = await request('/bookings','POST',{showId:show.show_id,seatNumbers:[seat]},otherToken);
      check(conflict.status >= 400,'NEW: overlapping seat hold is rejected');
      const payment = await request(`/bookings/${bookingId}/confirm`,'POST',{method:'UPI'},token);
      check(payment.status === 200,'Confirm payment succeeds');
      const mine = await request('/bookings/me','GET',undefined,token);
      check(mine.status === 200 && JSON.stringify(mine.data).includes(String(bookingId)),'Booking appears in My Bookings');
      const cancelled = await request(`/bookings/${bookingId}/cancel`,'POST',{},token);
      check(cancelled.status === 200,'Cancel booking succeeds');
      const freed = await request(`/shows/${show.show_id}/seats`);
      check(freed.data.seats?.some(s=>s.seat_no===seat && s.status==='AVAILABLE'),'Seat becomes AVAILABLE after cancellation');
      const badCoupon = await request('/bookings','POST',{showId:show.show_id,seatNumbers:[seat],couponCode:'NOSUCHCODE'},token);
      check(badCoupon.status === 400,'NEW: invalid coupon code is rejected');
      const withCoupon = await request('/bookings','POST',{showId:show.show_id,seatNumbers:[seat],couponCode:'WELCOME10'},token);
      check(withCoupon.status === 201 && !!withCoupon.data.bookingId,'NEW: valid coupon code is accepted');
      if (withCoupon.data.bookingId) {
        const detail = await request(`/bookings/${withCoupon.data.bookingId}`,'GET',undefined,token);
        check(JSON.stringify(detail.data).includes('discount_amount') && Number(detail.data.booking?.discount_amount) > 0,'NEW: coupon discount is recorded on the booking');
        await request(`/bookings/${withCoupon.data.bookingId}/cancel`,'POST',{},token);
      }
    }
  }
  const admin = await request('/admin/cities','GET',undefined,token);
  check([401,403].includes(admin.status),'Customer is blocked from admin routes');
  const manager = await request('/manager/shows','GET',undefined,token);
  check([401,403].includes(manager.status),'NEW: customer is blocked from manager routes');
  const invalid = await request('/shows/not-a-number/seats');
  check(invalid.status === 400,'NEW: invalid show ID is rejected');
  const duplicate = await request('/auth/register','POST',{name:'Duplicate',email,password});
  check(duplicate.status === 409,'NEW: duplicate email registration is rejected');
  // ---- Manager: schedule a show (W3 through the application) ----
  const mgrLogin = await request('/auth/login','POST',{email:'manager1@cinebook.test',password:'Password@123'});
  const mgrToken = mgrLogin.data.token;
  check(mgrLogin.status === 200 && !!mgrToken,'NEW: manager can log in');
  if (mgrToken) {
    const opts = await request('/manager/schedule-options','GET',undefined,mgrToken);
    const screen = opts.data.screens?.[0], movie = opts.data.movies?.[0];
    check(opts.status === 200 && !!screen && !!movie && screen.categories?.length > 0,'NEW: manager gets own screens and movies');
    if (screen && movie) {
      const allPrices = Object.fromEntries(screen.categories.map(c => [c, 250]));
      const start = new Date(Date.now() + (60 + Math.floor(Math.random()*600)) * 86400000);
      start.setUTCHours(3, 0, 0, 0);
      const body = {movieId:movie.movie_id,screenId:screen.screen_id,startTime:start.toISOString(),prices:allPrices};
      const created = await request('/manager/shows','POST',body,mgrToken);
      check(created.status === 201 && !!created.data.show?.show_id,'NEW: manager schedules a show with prices');
      const overlap = await request('/manager/shows','POST',body,mgrToken);
      check(overlap.status === 409,'NEW: overlapping show is rejected by the database');
      const badPrice = await request('/manager/shows','POST',{...body,startTime:new Date(start.getTime()+86400000*2).toISOString(),prices:{...allPrices,[screen.categories[0]]:0}},mgrToken);
      check(badPrice.status === 400,'NEW: price of 0 is rejected');
      const past = await request('/manager/shows','POST',{...body,startTime:'2020-01-01T10:00:00.000Z'},mgrToken);
      check(past.status === 400,'NEW: show in the past is rejected');
      const other = await request('/manager/schedule-options','GET',undefined,mgrToken);
      const foreignScreenId = Number(screen.screen_id) + 5;
      const ownIds = new Set(other.data.screens.map(s => String(s.screen_id)));
      if (!ownIds.has(String(foreignScreenId))) {
        const foreign = await request('/manager/shows','POST',{...body,screenId:foreignScreenId},mgrToken);
        check(foreign.status === 403,'NEW: manager cannot schedule on another venue\'s screen');
      }
      if (created.data.show?.show_id) {
        const seats = await request(`/shows/${created.data.show.show_id}/seats`);
        check(seats.status === 200 && seats.data.seats?.length > 0 && seats.data.seats.every(s => Number(s.price) === 250),'NEW: new show is bookable with the prices set');
      }
    }
    const asCustomer = await request('/manager/shows','POST',{},token);
    check([401,403].includes(asCustomer.status),'NEW: customer cannot schedule shows');
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode=1;
};
run().catch(err=>{console.error('Cannot run integration tests:',err.message);process.exitCode=1;});
