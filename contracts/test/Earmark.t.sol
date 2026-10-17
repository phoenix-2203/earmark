// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Earmark} from "../Earmark.sol";

// ---------------------------------------------------------------------------
// Minimal MockERC20 — written inline so no external mock lib is needed.
// Supports transfer, transferFrom, approve, allowance, balanceOf, mint.
// ---------------------------------------------------------------------------
contract MockERC20 {
    string public name;
    string public symbol;
    uint8  public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name     = _name;
        symbol   = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]          += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient");
        require(allowance[from][msg.sender] >= amount, "ERC20: allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Main test contract
// ---------------------------------------------------------------------------
contract EarmarkTest is Test {
    // -----------------------------------------------------------------------
    // Actors
    // -----------------------------------------------------------------------
    address internal sender      = makeAddr("sender");
    address internal beneficiary = makeAddr("beneficiary");
    address internal alice       = makeAddr("alice");   // first payee
    address internal bob         = makeAddr("bob");     // second payee
    address internal stranger    = makeAddr("stranger");

    // -----------------------------------------------------------------------
    // Contracts
    // -----------------------------------------------------------------------
    MockERC20 internal usdc;
    Earmark   internal earmark;

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------
    uint256 internal constant INITIAL_AMOUNT = 1_000e6;
    uint256 internal constant FUTURE_EXPIRY  = 365 days; // will be added to block.timestamp in setUp

    // -----------------------------------------------------------------------
    // setUp — runs before every test
    // -----------------------------------------------------------------------
    function setUp() public {
        usdc    = new MockERC20("Mock USDC", "mUSDC", 6);
        earmark = new Earmark(address(usdc));

        // Fund the sender and approve the earmark contract
        usdc.mint(sender, 100_000e6);
        vm.prank(sender);
        usdc.approve(address(earmark), type(uint256).max);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Create a standard pot and return its potId.
    function _createPot(uint256 amount) internal returns (uint256 potId) {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        vm.prank(sender);
        potId = earmark.createPot(
            beneficiary,
            "Test Pot",
            Earmark.Category.Other,
            amount,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    /// Create a pot with multiple payees (alice + bob).
    function _createPotMulti(uint256 amount) internal returns (uint256 potId) {
        address[] memory payees      = new address[](2);
        string[]  memory payeeLabels = new string[](2);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";
        payees[1]      = bob;
        payeeLabels[1] = "Bob";

        vm.prank(sender);
        potId = earmark.createPot(
            beneficiary,
            "Multi Pot",
            Earmark.Category.Other,
            amount,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 1. createPot — happy path, USDC pulled from sender
    // -----------------------------------------------------------------------
    function test_CreatePot_PullsUSDCFromSender() public {
        uint256 balBefore = usdc.balanceOf(sender);
        uint256 potId     = _createPot(INITIAL_AMOUNT);
        uint256 balAfter  = usdc.balanceOf(sender);

        assertEq(balBefore - balAfter, INITIAL_AMOUNT, "sender balance should decrease by amount");
        assertEq(usdc.balanceOf(address(earmark)), INITIAL_AMOUNT, "contract should hold the USDC");

        Earmark.Pot memory pot = earmark.getPot(potId);
        assertEq(pot.balance,      INITIAL_AMOUNT);
        assertEq(pot.totalFunded,  INITIAL_AMOUNT);
        assertEq(pot.sender,       sender);
        assertEq(pot.beneficiary,  beneficiary);
    }

    // -----------------------------------------------------------------------
    // 2. createPot — ZeroAddress if beneficiary is zero
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertZeroAddress() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        vm.prank(sender);
        vm.expectRevert(Earmark.ZeroAddress.selector);
        earmark.createPot(
            address(0),
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 3. createPot — AtLeastOnePayee for empty payees array
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertAtLeastOnePayee() public {
        address[] memory payees      = new address[](0);
        string[]  memory payeeLabels = new string[](0);

        vm.prank(sender);
        vm.expectRevert(Earmark.AtLeastOnePayee.selector);
        earmark.createPot(
            beneficiary,
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 4. createPot — PayeeLengthMismatch
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertPayeeLengthMismatch() public {
        address[] memory payees      = new address[](2);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payees[1]      = bob;
        payeeLabels[0] = "Alice";

        vm.prank(sender);
        vm.expectRevert(Earmark.PayeeLengthMismatch.selector);
        earmark.createPot(
            beneficiary,
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 5. createPot — TitleTooLong (> 64 bytes)
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertTitleTooLong() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        // 65-byte title
        string memory longTitle = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 67 chars > 64

        vm.prank(sender);
        vm.expectRevert(Earmark.TitleTooLong.selector);
        earmark.createPot(
            beneficiary,
            longTitle,
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 6. createPot — MaxPayeesReached (> 20)
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertMaxPayeesReached() public {
        uint256 n = 21;
        address[] memory payees      = new address[](n);
        string[]  memory payeeLabels = new string[](n);
        for (uint256 i = 0; i < n; ++i) {
            payees[i]      = makeAddr(string(abi.encodePacked("payee", i)));
            payeeLabels[i] = "label";
        }

        vm.prank(sender);
        vm.expectRevert(Earmark.MaxPayeesReached.selector);
        earmark.createPot(
            beneficiary,
            "Big Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 7. createPot — SenderCannotBePayee
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertSenderCannotBePayee() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = sender; // sender as payee — must revert
        payeeLabels[0] = "Me";

        vm.prank(sender);
        vm.expectRevert(Earmark.SenderCannotBePayee.selector);
        earmark.createPot(
            beneficiary,
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 8. createPot — BeneficiaryCannotBePayee
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertBeneficiaryCannotBePayee() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = beneficiary; // beneficiary as payee — must revert
        payeeLabels[0] = "Ben";

        vm.prank(sender);
        vm.expectRevert(Earmark.BeneficiaryCannotBePayee.selector);
        earmark.createPot(
            beneficiary,
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 9. createPot — InvalidExpiry if expiry <= block.timestamp
    // -----------------------------------------------------------------------
    function test_CreatePot_RevertInvalidExpiry() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        vm.prank(sender);
        vm.expectRevert(Earmark.InvalidExpiry.selector);
        earmark.createPot(
            beneficiary,
            "Bad Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp, // equal → must revert
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // 10. pay — PayeeNotApproved for an unapproved payee
    // -----------------------------------------------------------------------
    function test_Pay_RevertPayeeNotApproved() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Earmark.PayeeNotApproved.selector, stranger));
        earmark.pay(potId, stranger, 1e6, "");
    }

    // -----------------------------------------------------------------------
    // 11. pay — NotParticipant (called by non-sender, non-beneficiary)
    // -----------------------------------------------------------------------
    function test_Pay_RevertNotParticipant() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(Earmark.NotParticipant.selector);
        earmark.pay(potId, alice, 1e6, "");
    }

    // -----------------------------------------------------------------------
    // 12. pay — InsufficientBalance (overspend)
    // -----------------------------------------------------------------------
    function test_Pay_RevertInsufficientBalance() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        vm.expectRevert(Earmark.InsufficientBalance.selector);
        earmark.pay(potId, alice, INITIAL_AMOUNT + 1, "too much");
    }

    // -----------------------------------------------------------------------
    // 13. pay — PotExpired after expiry timestamp
    // -----------------------------------------------------------------------
    function test_Pay_RevertPotExpired() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Warp past expiry
        vm.warp(block.timestamp + FUTURE_EXPIRY + 1);

        vm.prank(sender);
        vm.expectRevert(Earmark.PotExpired.selector);
        earmark.pay(potId, alice, 1e6, "late");
    }

    // -----------------------------------------------------------------------
    // 14. pay — PotClosed after pot is closed via releaseToBeneficiary
    // -----------------------------------------------------------------------
    function test_Pay_RevertPotClosed() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Close the pot
        vm.prank(sender);
        earmark.releaseToBeneficiary(potId);

        vm.prank(sender);
        vm.expectRevert(Earmark.PotClosed.selector);
        earmark.pay(potId, alice, 1e6, "closed");
    }

    // -----------------------------------------------------------------------
    // 15. reclaim — NotSender for non-sender caller
    // -----------------------------------------------------------------------
    function test_Reclaim_RevertNotSender() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Warp past expiry so reclaim would otherwise succeed
        vm.warp(block.timestamp + FUTURE_EXPIRY + 1);

        vm.prank(stranger);
        vm.expectRevert(Earmark.NotSender.selector);
        earmark.reclaim(potId);
    }

    // -----------------------------------------------------------------------
    // 16. reclaim — InvalidExpiry before expiry
    // -----------------------------------------------------------------------
    function test_Reclaim_RevertInvalidExpiryBeforeExpiry() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        vm.expectRevert(Earmark.InvalidExpiry.selector);
        earmark.reclaim(potId);
    }

    // -----------------------------------------------------------------------
    // 17. reclaim — sends remaining balance to sender and closes pot
    // -----------------------------------------------------------------------
    function test_Reclaim_AfterExpirySendsBalanceAndCloses() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Spend some first
        vm.prank(sender);
        earmark.pay(potId, alice, 100e6, "partial");

        uint256 remaining    = INITIAL_AMOUNT - 100e6;
        uint256 senderBefore = usdc.balanceOf(sender);

        // Warp past expiry
        vm.warp(block.timestamp + FUTURE_EXPIRY + 1);

        vm.expectEmit(true, true, false, true, address(earmark));
        emit Earmark.Reclaimed(potId, sender, remaining);

        vm.prank(sender);
        earmark.reclaim(potId);

        assertEq(usdc.balanceOf(sender), senderBefore + remaining, "sender should receive remaining");
        assertTrue(earmark.getPot(potId).closed, "pot should be closed");
        assertEq(earmark.getPot(potId).balance, 0, "pot balance should be zero");
    }

    // -----------------------------------------------------------------------
    // 18. releaseToBeneficiary — sends remaining balance and closes pot
    // -----------------------------------------------------------------------
    function test_ReleaseToBeneficiary_SendsBalanceAndCloses() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Spend some
        vm.prank(sender);
        earmark.pay(potId, alice, 200e6, "spend");

        uint256 remaining   = INITIAL_AMOUNT - 200e6;
        uint256 benBefore   = usdc.balanceOf(beneficiary);

        vm.expectEmit(true, true, false, true, address(earmark));
        emit Earmark.Released(potId, beneficiary, remaining);

        vm.prank(sender);
        earmark.releaseToBeneficiary(potId);

        assertEq(usdc.balanceOf(beneficiary), benBefore + remaining, "beneficiary should receive remaining");
        assertTrue(earmark.getPot(potId).closed, "pot should be closed");
        assertEq(earmark.getPot(potId).balance, 0, "pot balance should be zero");
    }

    // -----------------------------------------------------------------------
    // 19. releaseToBeneficiary — NotSender for non-sender caller
    // -----------------------------------------------------------------------
    function test_ReleaseToBeneficiary_RevertNotSender() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(Earmark.NotSender.selector);
        earmark.releaseToBeneficiary(potId);
    }

    // -----------------------------------------------------------------------
    // 20. requestPayee / approvePayeeRequest / rejectPayeeRequest flow
    // -----------------------------------------------------------------------
    function test_RequestApproveRejectPayeeFlow() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // --- request ---
        vm.expectEmit(true, true, true, true, address(earmark));
        emit Earmark.PayeeRequested(potId, 0, bob, "Bob label", "need bob");

        vm.prank(beneficiary);
        earmark.requestPayee(potId, bob, "Bob label", "need bob");

        Earmark.PayeeRequest[] memory reqs = earmark.getPayeeRequests(potId);
        assertEq(reqs.length, 1);
        assertEq(reqs[0].payee, bob);
        assertFalse(reqs[0].resolved);

        // --- approve ---
        vm.expectEmit(true, true, true, false, address(earmark));
        emit Earmark.PayeeRequestApproved(potId, 0, bob);

        vm.prank(sender);
        earmark.approvePayeeRequest(potId, 0);

        reqs = earmark.getPayeeRequests(potId);
        assertTrue(reqs[0].resolved);
        assertTrue(reqs[0].approved);

        // bob can now be paid
        vm.prank(sender);
        earmark.pay(potId, bob, 1e6, "approved payment");
        assertEq(earmark.getPot(potId).totalSpent, 1e6);

        // --- reject a second request ---
        vm.prank(beneficiary);
        earmark.requestPayee(potId, stranger, "Stranger", "need stranger");

        vm.expectEmit(true, true, true, false, address(earmark));
        emit Earmark.PayeeRequestRejected(potId, 1, stranger);

        vm.prank(sender);
        earmark.rejectPayeeRequest(potId, 1);

        reqs = earmark.getPayeeRequests(potId);
        assertTrue(reqs[1].resolved);
        assertFalse(reqs[1].approved);
    }

    // -----------------------------------------------------------------------
    // 21. addPayee — BeneficiaryCannotBePayee
    // -----------------------------------------------------------------------
    function test_AddPayee_RevertBeneficiaryCannotBePayee() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        vm.expectRevert(Earmark.BeneficiaryCannotBePayee.selector);
        earmark.addPayee(potId, beneficiary, "ben label");
    }

    // -----------------------------------------------------------------------
    // 22. addPayee — SenderCannotBePayee
    // -----------------------------------------------------------------------
    function test_AddPayee_RevertSenderCannotBePayee() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        vm.expectRevert(Earmark.SenderCannotBePayee.selector);
        earmark.addPayee(potId, sender, "sender label");
    }

    // -----------------------------------------------------------------------
    // 23. requestPayee / approvePayeeRequest — BeneficiaryCannotBePayee
    // -----------------------------------------------------------------------
    function test_RequestPayee_RevertBeneficiaryCannotBePayee() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(beneficiary);
        vm.expectRevert(Earmark.BeneficiaryCannotBePayee.selector);
        earmark.requestPayee(potId, beneficiary, "self", "self reason");
    }

    // -----------------------------------------------------------------------
    // 24. requestPayee — SenderCannotBePayee (beneficiary requests the sender)
    // -----------------------------------------------------------------------
    function test_RequestPayee_RevertSenderCannotBePayee() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(beneficiary);
        vm.expectRevert(Earmark.SenderCannotBePayee.selector);
        earmark.requestPayee(potId, sender, "sender", "sender reason");
    }

    // -----------------------------------------------------------------------
    // 25. removePayee — later payment is blocked (PayeeNotApproved)
    // -----------------------------------------------------------------------
    function test_RemovePayee_BlocksLaterPayments() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // alice is in the pot; remove her
        vm.prank(sender);
        earmark.removePayee(potId, alice);

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Earmark.PayeeNotApproved.selector, alice));
        earmark.pay(potId, alice, 1e6, "should fail");
    }

    // -----------------------------------------------------------------------
    // 26. topUp — increases balance; only sender can topUp
    // -----------------------------------------------------------------------
    function test_TopUp_IncreasesBalance() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        uint256 topUpAmount = 500e6;
        uint256 senderBefore = usdc.balanceOf(sender);

        vm.expectEmit(true, true, false, true, address(earmark));
        emit Earmark.ToppedUp(potId, sender, topUpAmount);

        vm.prank(sender);
        earmark.topUp(potId, topUpAmount);

        Earmark.Pot memory pot = earmark.getPot(potId);
        assertEq(pot.balance,     INITIAL_AMOUNT + topUpAmount);
        assertEq(pot.totalFunded, INITIAL_AMOUNT + topUpAmount);
        assertEq(usdc.balanceOf(sender), senderBefore - topUpAmount, "USDC pulled from sender");
    }

    function test_TopUp_RevertNotSender() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(Earmark.NotSender.selector);
        earmark.topUp(potId, 1e6);
    }

    // -----------------------------------------------------------------------
    // 27. extendExpiry — works, reverts ExpiryNotLater if not later
    // -----------------------------------------------------------------------
    function test_ExtendExpiry_Works() public {
        uint256 potId     = _createPot(INITIAL_AMOUNT);
        uint256 newExpiry = block.timestamp + FUTURE_EXPIRY + 30 days;

        vm.expectEmit(true, false, false, true, address(earmark));
        emit Earmark.ExpiryExtended(potId, newExpiry);

        vm.prank(sender);
        earmark.extendExpiry(potId, newExpiry);

        assertEq(earmark.getPot(potId).expiry, newExpiry);
    }

    function test_ExtendExpiry_RevertExpiryNotLater() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);
        uint256 currentExpiry = earmark.getPot(potId).expiry;

        vm.prank(sender);
        vm.expectRevert(Earmark.ExpiryNotLater.selector);
        earmark.extendExpiry(potId, currentExpiry); // equal → not later
    }

    function test_ExtendExpiry_RevertExpiryEarlier() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);
        uint256 currentExpiry = earmark.getPot(potId).expiry;

        vm.prank(sender);
        vm.expectRevert(Earmark.ExpiryNotLater.selector);
        earmark.extendExpiry(potId, currentExpiry - 1); // earlier → not later
    }

    // -----------------------------------------------------------------------
    // 28. String length limits — TitleTooLong, LabelTooLong, MemoTooLong, ReasonTooLong
    // -----------------------------------------------------------------------
    function test_CreatePot_AcceptsExactly64ByteTitle() public {
        // 64 'A's — should succeed
        string memory title64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 64

        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        vm.prank(sender);
        uint256 potId = earmark.createPot(
            beneficiary,
            title64,
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );
        assertGt(potId, 0);
    }

    function test_AddPayee_RevertLabelTooLong() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // 49 bytes > 48 limit
        string memory longLabel = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 49

        vm.prank(sender);
        vm.expectRevert(Earmark.LabelTooLong.selector);
        earmark.addPayee(potId, bob, longLabel);
    }

    function test_Pay_RevertMemoTooLong() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // 141-byte memo (> 140 limit)
        string memory longMemo = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 141

        vm.prank(sender);
        vm.expectRevert(Earmark.MemoTooLong.selector);
        earmark.pay(potId, alice, 1e6, longMemo);
    }

    function test_RequestPayee_RevertReasonTooLong() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // 141-byte reason (> 140 limit)
        string memory longReason = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 141

        vm.prank(beneficiary);
        vm.expectRevert(Earmark.ReasonTooLong.selector);
        earmark.requestPayee(potId, bob, "ok", longReason);
    }

    // -----------------------------------------------------------------------
    // 29. payments are stored and readable via getPayments
    // -----------------------------------------------------------------------
    function test_GetPayments_StoresPaymentData() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        uint256 amt = 50e6;
        vm.prank(sender);
        earmark.pay(potId, alice, amt, "hello");

        Earmark.Payment[] memory payments = earmark.getPayments(potId);
        assertEq(payments.length,    1);
        assertEq(payments[0].payee,  alice);
        assertEq(payments[0].amount, amt);
        assertEq(payments[0].memo,   "hello");
        assertEq(payments[0].payer,  sender);
        assertGt(payments[0].timestamp, 0);
    }

    function test_GetPayments_MultiplePayments() public {
        uint256 potId = _createPotMulti(INITIAL_AMOUNT);

        vm.startPrank(sender);
        earmark.pay(potId, alice, 10e6, "first");
        earmark.pay(potId, bob,   20e6, "second");
        earmark.pay(potId, alice, 30e6, "third");
        vm.stopPrank();

        Earmark.Payment[] memory payments = earmark.getPayments(potId);
        assertEq(payments.length, 3);
        assertEq(payments[0].amount, 10e6);
        assertEq(payments[1].amount, 20e6);
        assertEq(payments[2].amount, 30e6);
        assertEq(earmark.getPot(potId).totalSpent, 60e6);
    }

    // -----------------------------------------------------------------------
    // 30. Balance invariant: totalFunded == totalSpent + released/reclaimed
    // -----------------------------------------------------------------------
    function test_BalanceInvariant_FullLifecycleReclaim() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // spend some
        uint256 spent1 = 200e6;
        uint256 spent2 = 300e6;
        vm.startPrank(sender);
        earmark.pay(potId, alice, spent1, "s1");
        earmark.pay(potId, alice, spent2, "s2");
        vm.stopPrank();

        uint256 totalSpent = spent1 + spent2;

        // warp past expiry and reclaim
        vm.warp(block.timestamp + FUTURE_EXPIRY + 1);

        uint256 senderBefore = usdc.balanceOf(sender);
        vm.prank(sender);
        earmark.reclaim(potId);
        uint256 senderReclaimed = usdc.balanceOf(sender) - senderBefore;

        Earmark.Pot memory pot = earmark.getPot(potId);

        // invariant: totalFunded == totalSpent + returned-to-sender
        assertEq(pot.totalFunded, totalSpent + senderReclaimed, "invariant: totalFunded == spent + reclaimed");
        assertEq(pot.balance, 0, "pot balance should be zero after reclaim");
        assertTrue(pot.closed);
    }

    function test_BalanceInvariant_FullLifecycleRelease() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        uint256 spent = 150e6;
        vm.prank(sender);
        earmark.pay(potId, alice, spent, "pay");

        uint256 benBefore  = usdc.balanceOf(beneficiary);

        vm.prank(sender);
        earmark.releaseToBeneficiary(potId);

        uint256 benReceived = usdc.balanceOf(beneficiary) - benBefore;

        Earmark.Pot memory pot = earmark.getPot(potId);
        assertEq(pot.totalFunded, pot.totalSpent + benReceived, "invariant: totalFunded == spent + released");
    }

    // -----------------------------------------------------------------------
    // 31. potsOfSender and potsOfBeneficiary return correct IDs
    // -----------------------------------------------------------------------
    function test_PotsOfSenderAndBeneficiary() public {
        uint256 potId1 = _createPot(INITIAL_AMOUNT);
        uint256 potId2 = _createPot(INITIAL_AMOUNT);

        uint256[] memory senderPots = earmark.potsOfSender(sender);
        assertEq(senderPots.length, 2);
        assertEq(senderPots[0], potId1);
        assertEq(senderPots[1], potId2);

        uint256[] memory benPots = earmark.potsOfBeneficiary(beneficiary);
        assertEq(benPots.length, 2);
        assertEq(benPots[0], potId1);
        assertEq(benPots[1], potId2);
    }

    function test_PotsOfSender_OnlyOwnPots() public {
        // sender creates one pot; a different sender (alice) creates another
        _createPot(INITIAL_AMOUNT); // sender's pot

        usdc.mint(alice, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(earmark), type(uint256).max);

        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = bob;
        payeeLabels[0] = "Bob";

        vm.prank(alice); // alice is sender here
        earmark.createPot(
            beneficiary,
            "Alice's Pot",
            Earmark.Category.Other,
            INITIAL_AMOUNT,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );

        assertEq(earmark.potsOfSender(sender).length, 1);
        assertEq(earmark.potsOfSender(alice).length,  1);
    }

    // -----------------------------------------------------------------------
    // Fuzz: createPot amount round-trip (balance check)
    // -----------------------------------------------------------------------
    function testFuzz_CreatePot_BalanceRoundTrip(uint256 amount) public {
        amount = bound(amount, 0, 10_000_000e6);

        // Make sure sender has enough
        usdc.mint(sender, amount);

        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "A";

        uint256 contractBefore = usdc.balanceOf(address(earmark));
        uint256 senderBefore   = usdc.balanceOf(sender);

        vm.prank(sender);
        uint256 potId = earmark.createPot(
            beneficiary,
            "Fuzz",
            Earmark.Category.Other,
            amount,
            block.timestamp + FUTURE_EXPIRY,
            payees,
            payeeLabels
        );

        assertEq(usdc.balanceOf(address(earmark)), contractBefore + amount);
        assertEq(usdc.balanceOf(sender),           senderBefore   - amount);
        assertEq(earmark.getPot(potId).balance,     amount);
        assertEq(earmark.getPot(potId).totalFunded, amount);
    }

    // -----------------------------------------------------------------------
    // Fuzz: pay amount stays within balance
    // -----------------------------------------------------------------------
    function testFuzz_Pay_NeverExceedsBalance(uint256 payAmount) public {
        uint256 potId = _createPot(INITIAL_AMOUNT);
        payAmount = bound(payAmount, 1, INITIAL_AMOUNT);

        vm.prank(sender);
        earmark.pay(potId, alice, payAmount, "fuzz");

        Earmark.Pot memory pot = earmark.getPot(potId);
        assertEq(pot.balance,    INITIAL_AMOUNT - payAmount);
        assertEq(pot.totalSpent, payAmount);
    }

    // -----------------------------------------------------------------------
    // Invariant: pot balance + totalSpent == totalFunded at all times
    // -----------------------------------------------------------------------

    // Handler that drives random sequences of createPot/topUp/pay calls
    // and lets the invariant check the accounting at every step.
    function invariant_PotAccountingNeverDrifts() public view {
        uint256 count = earmark.potCount();
        for (uint256 i = 1; i <= count; ++i) {
            Earmark.Pot memory pot = earmark.getPot(i);
            // balance + totalSpent == totalFunded  (closed pots have balance==0)
            assertEq(
                pot.balance + pot.totalSpent,
                pot.totalFunded,
                "INVARIANT: balance + spent != totalFunded"
            );
        }
    }

    // -----------------------------------------------------------------------
    // Extra: PotCreated event is emitted correctly
    // -----------------------------------------------------------------------
    function test_CreatePot_EmitsPotCreated() public {
        address[] memory payees      = new address[](1);
        string[]  memory payeeLabels = new string[](1);
        payees[0]      = alice;
        payeeLabels[0] = "Alice";

        uint256 expiry = block.timestamp + FUTURE_EXPIRY;

        vm.expectEmit(true, true, true, true, address(earmark));
        emit Earmark.PotCreated(1, sender, beneficiary, "Event Pot", Earmark.Category.School, INITIAL_AMOUNT, expiry);

        vm.prank(sender);
        earmark.createPot(
            beneficiary,
            "Event Pot",
            Earmark.Category.School,
            INITIAL_AMOUNT,
            expiry,
            payees,
            payeeLabels
        );
    }

    // -----------------------------------------------------------------------
    // Extra: Paid event is emitted correctly
    // -----------------------------------------------------------------------
    function test_Pay_EmitsPaid() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);
        uint256 amt   = 42e6;

        vm.expectEmit(true, true, true, true, address(earmark));
        emit Earmark.Paid(potId, 0, alice, amt, "test memo", sender);

        vm.prank(sender);
        earmark.pay(potId, alice, amt, "test memo");
    }

    // -----------------------------------------------------------------------
    // Extra: Beneficiary can also call pay as a participant
    // -----------------------------------------------------------------------
    function test_Pay_BeneficiaryCanPay() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(beneficiary);
        earmark.pay(potId, alice, 1e6, "from ben");

        assertEq(earmark.getPot(potId).totalSpent, 1e6);
    }

    // -----------------------------------------------------------------------
    // Extra: RequestAlreadyResolved on double-resolve
    // -----------------------------------------------------------------------
    function test_ApprovePayeeRequest_RevertAlreadyResolved() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(beneficiary);
        earmark.requestPayee(potId, bob, "Bob", "reason");

        vm.prank(sender);
        earmark.approvePayeeRequest(potId, 0);

        vm.prank(sender);
        vm.expectRevert(Earmark.RequestAlreadyResolved.selector);
        earmark.approvePayeeRequest(potId, 0);
    }

    function test_RejectPayeeRequest_RevertAlreadyResolved() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(beneficiary);
        earmark.requestPayee(potId, bob, "Bob", "reason");

        vm.prank(sender);
        earmark.rejectPayeeRequest(potId, 0);

        vm.prank(sender);
        vm.expectRevert(Earmark.RequestAlreadyResolved.selector);
        earmark.rejectPayeeRequest(potId, 0);
    }

    // -----------------------------------------------------------------------
    // Extra: topUp on a closed pot is blocked
    // -----------------------------------------------------------------------
    function test_TopUp_RevertPotClosed() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        vm.prank(sender);
        earmark.releaseToBeneficiary(potId);

        vm.prank(sender);
        vm.expectRevert(Earmark.PotClosed.selector);
        earmark.topUp(potId, 1e6);
    }

    // -----------------------------------------------------------------------
    // Extra: reclaim on already-closed pot is blocked
    // -----------------------------------------------------------------------
    function test_Reclaim_RevertPotClosed() public {
        uint256 potId = _createPot(INITIAL_AMOUNT);

        // Close via release
        vm.prank(sender);
        earmark.releaseToBeneficiary(potId);

        // Warp past expiry and try to reclaim
        vm.warp(block.timestamp + FUTURE_EXPIRY + 1);

        vm.prank(sender);
        vm.expectRevert(Earmark.PotClosed.selector);
        earmark.reclaim(potId);
    }

    // -----------------------------------------------------------------------
    // Extra: getPayees reflects only current approved payees after remove
    // -----------------------------------------------------------------------
    function test_GetPayees_ReflectsRemoval() public {
        uint256 potId = _createPotMulti(INITIAL_AMOUNT);

        (address[] memory addrs,) = earmark.getPayees(potId);
        assertEq(addrs.length, 2);

        vm.prank(sender);
        earmark.removePayee(potId, alice);

        (addrs,) = earmark.getPayees(potId);
        assertEq(addrs.length, 1);
        assertEq(addrs[0], bob);
    }

    // -----------------------------------------------------------------------
    // Extra: potCount increments correctly
    // -----------------------------------------------------------------------
    function test_PotCount_Increments() public {
        assertEq(earmark.potCount(), 0);
        _createPot(INITIAL_AMOUNT);
        assertEq(earmark.potCount(), 1);
        _createPot(INITIAL_AMOUNT);
        assertEq(earmark.potCount(), 2);
    }
}
