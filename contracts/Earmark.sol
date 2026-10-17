// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Earmark is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Category {
        School,
        Rent,
        Medical,
        Business,
        Other
    }

    struct Payment {
        address payee;
        uint256 amount;
        string memo;
        uint256 timestamp;
        address payer;
    }

    struct PayeeRequest {
        address payee;
        string label;
        string reason;
        bool resolved;
        bool approved;
    }

    struct Pot {
        uint256 id;
        address sender;
        address beneficiary;
        string title;
        Category category;
        uint256 balance;
        uint256 totalFunded;
        uint256 totalSpent;
        uint256 expiry;
        bool closed;
    }

    error ZeroAddress();
    error ZeroAmount();
    error SelfBeneficiary();
    error InvalidExpiry();
    error PotClosed();
    error PotExpired();
    error NotSender();
    error NotBeneficiary();
    error NotParticipant();
    error AlreadyApprovedPayee();
    error PayeeNotApproved(address payee);
    error SenderCannotBePayee();
    error BeneficiaryCannotBePayee();
    error ContractCannotBePayee();
    error MaxPayeesReached();
    error TooManyPendingRequests();
    error TitleTooLong();
    error LabelTooLong();
    error MemoTooLong();
    error ReasonTooLong();
    error InsufficientBalance();
    error AtLeastOnePayee();
    error RequestAlreadyResolved();
    error ExpiryNotLater();
    error PayeeLengthMismatch();

    event PotCreated(
        uint256 indexed potId,
        address indexed sender,
        address indexed beneficiary,
        string title,
        Category category,
        uint256 amount,
        uint256 expiry
    );
    event ToppedUp(uint256 indexed potId, address indexed sender, uint256 amount);
    event PayeeAdded(uint256 indexed potId, address indexed payee, string label);
    event PayeeRemoved(uint256 indexed potId, address indexed payee);
    event PayeeRequested(
        uint256 indexed potId,
        uint256 indexed requestId,
        address indexed payee,
        string label,
        string reason
    );
    event PayeeRequestApproved(uint256 indexed potId, uint256 indexed requestId, address indexed payee);
    event PayeeRequestRejected(uint256 indexed potId, uint256 indexed requestId, address indexed payee);
    event Paid(
        uint256 indexed potId,
        uint256 indexed paymentIndex,
        address indexed payee,
        uint256 amount,
        string memo,
        address payer
    );
    event Reclaimed(uint256 indexed potId, address indexed sender, uint256 amount);
    event Released(uint256 indexed potId, address indexed beneficiary, uint256 amount);
    event ExpiryExtended(uint256 indexed potId, uint256 newExpiry);

    uint256 private constant MAX_PAYEES = 20;
    uint256 private constant MAX_TITLE_BYTES = 64;
    uint256 private constant MAX_LABEL_BYTES = 48;
    uint256 private constant MAX_MEMO_BYTES = 140;
    uint256 private constant MAX_REASON_BYTES = 140;

    mapping(uint256 => Pot) public pots;
    uint256 public potCount;

    mapping(uint256 => address[]) internal _payeeList;
    mapping(uint256 => mapping(address => bool)) internal _isApprovedPayee;
    mapping(uint256 => mapping(address => string)) internal _payeeLabel;
    mapping(uint256 => Payment[]) internal _payments;
    mapping(uint256 => PayeeRequest[]) internal _payeeRequests;
    mapping(uint256 => uint256) internal _pendingRequestCount;
    mapping(address => uint256[]) internal _senderPots;
    mapping(address => uint256[]) internal _beneficiaryPots;

    IERC20 public immutable usdc;

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    function createPot(
        address beneficiary,
        string calldata title,
        Category category,
        uint256 amount,
        uint256 expiry,
        address[] calldata payees,
        string[] calldata payeeLabels
    ) external nonReentrant returns (uint256 potId) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (beneficiary == msg.sender) revert SelfBeneficiary();
        if (amount == 0) revert ZeroAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (bytes(title).length > MAX_TITLE_BYTES) revert TitleTooLong();
        if (payees.length == 0) revert AtLeastOnePayee();
        if (payees.length != payeeLabels.length) revert PayeeLengthMismatch();
        if (payees.length > MAX_PAYEES) revert MaxPayeesReached();

        potId = ++potCount;

        Pot storage pot = pots[potId];
        pot.id = potId;
        pot.sender = msg.sender;
        pot.beneficiary = beneficiary;
        pot.title = title;
        pot.category = category;
        pot.balance = amount;
        pot.totalFunded = amount;
        pot.expiry = expiry;

        _senderPots[msg.sender].push(potId);
        _beneficiaryPots[beneficiary].push(potId);

        for (uint256 i = 0; i < payees.length; ++i) {
            if (bytes(payeeLabels[i]).length > MAX_LABEL_BYTES) revert LabelTooLong();
            _addPayee(potId, msg.sender, beneficiary, payees[i], payeeLabels[i]);
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit PotCreated(potId, msg.sender, beneficiary, title, category, amount, expiry);
    }

    function topUp(uint256 potId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        pot.balance += amount;
        pot.totalFunded += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit ToppedUp(potId, msg.sender, amount);
    }

    function addPayee(uint256 potId, address payee, string calldata label) external {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        if (_payeeList[potId].length >= MAX_PAYEES) revert MaxPayeesReached();
        if (bytes(label).length > MAX_LABEL_BYTES) revert LabelTooLong();

        _addPayee(potId, pot.sender, pot.beneficiary, payee, label);
    }

    function removePayee(uint256 potId, address payee) external {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        if (!_isApprovedPayee[potId][payee]) revert PayeeNotApproved(payee);

        _isApprovedPayee[potId][payee] = false;
        delete _payeeLabel[potId][payee];

        address[] storage list = _payeeList[potId];
        uint256 len = list.length;
        for (uint256 i = 0; i < len; ++i) {
            if (list[i] == payee) {
                uint256 last = len - 1;
                if (i != last) {
                    list[i] = list[last];
                }
                list.pop();
                break;
            }
        }

        emit PayeeRemoved(potId, payee);
    }

    function requestPayee(uint256 potId, address payee, string calldata label, string calldata reason) external {
        Pot storage pot = pots[potId];
        _requireBeneficiary(pot);
        _requireOpen(pot);

        if (_isApprovedPayee[potId][payee]) revert AlreadyApprovedPayee();
        if (_pendingRequestCount[potId] >= 10) revert TooManyPendingRequests();
        if (bytes(label).length > MAX_LABEL_BYTES) revert LabelTooLong();
        if (bytes(reason).length > MAX_REASON_BYTES) revert ReasonTooLong();
        _validatePayee(pot.sender, pot.beneficiary, payee);

        _pendingRequestCount[potId] += 1;

        uint256 requestId = _payeeRequests[potId].length;
        _payeeRequests[potId].push(
            PayeeRequest({payee: payee, label: label, reason: reason, resolved: false, approved: false})
        );

        emit PayeeRequested(potId, requestId, payee, label, reason);
    }

    function approvePayeeRequest(uint256 potId, uint256 requestId) external {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        PayeeRequest storage req = _payeeRequests[potId][requestId];
        if (req.resolved) revert RequestAlreadyResolved();
        if (_payeeList[potId].length >= MAX_PAYEES) revert MaxPayeesReached();
        if (_isApprovedPayee[potId][req.payee]) revert AlreadyApprovedPayee();

        _validatePayee(pot.sender, pot.beneficiary, req.payee);

        req.resolved = true;
        req.approved = true;
        _pendingRequestCount[potId] -= 1;

        _isApprovedPayee[potId][req.payee] = true;
        _payeeLabel[potId][req.payee] = req.label;
        _payeeList[potId].push(req.payee);

        emit PayeeRequestApproved(potId, requestId, req.payee);
        emit PayeeAdded(potId, req.payee, req.label);
    }

    function rejectPayeeRequest(uint256 potId, uint256 requestId) external {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        PayeeRequest storage req = _payeeRequests[potId][requestId];
        if (req.resolved) revert RequestAlreadyResolved();

        req.resolved = true;
        req.approved = false;
        _pendingRequestCount[potId] -= 1;

        emit PayeeRequestRejected(potId, requestId, req.payee);
    }

    function pay(uint256 potId, address payee, uint256 amount, string calldata memo) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Pot storage pot = pots[potId];
        _requireParticipant(pot);
        _requireOpen(pot);
        if (block.timestamp >= pot.expiry) revert PotExpired();
        if (!_isApprovedPayee[potId][payee]) revert PayeeNotApproved(payee);
        if (bytes(memo).length > MAX_MEMO_BYTES) revert MemoTooLong();
        if (amount > pot.balance) revert InsufficientBalance();

        pot.balance -= amount;
        pot.totalSpent += amount;

        uint256 paymentIndex = _payments[potId].length;
        _payments[potId].push(
            Payment({payee: payee, amount: amount, memo: memo, timestamp: block.timestamp, payer: msg.sender})
        );

        usdc.safeTransfer(payee, amount);

        emit Paid(potId, paymentIndex, payee, amount, memo, msg.sender);
    }

    function reclaim(uint256 potId) external nonReentrant {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        if (pot.closed) revert PotClosed();
        if (block.timestamp < pot.expiry) revert InvalidExpiry();

        uint256 remaining = pot.balance;
        pot.balance = 0;
        pot.closed = true;

        usdc.safeTransfer(pot.sender, remaining);

        emit Reclaimed(potId, pot.sender, remaining);
    }

    function releaseToBeneficiary(uint256 potId) external nonReentrant {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        uint256 remaining = pot.balance;
        pot.balance = 0;
        pot.closed = true;

        usdc.safeTransfer(pot.beneficiary, remaining);

        emit Released(potId, pot.beneficiary, remaining);
    }

    function extendExpiry(uint256 potId, uint256 newExpiry) external {
        Pot storage pot = pots[potId];
        _requireSender(pot);
        _requireOpen(pot);

        if (newExpiry <= pot.expiry) revert ExpiryNotLater();
        pot.expiry = newExpiry;

        emit ExpiryExtended(potId, newExpiry);
    }

    function getPot(uint256 potId) external view returns (Pot memory) {
        return pots[potId];
    }

    function potsOfSender(address sender) external view returns (uint256[] memory) {
        return _senderPots[sender];
    }

    function potsOfBeneficiary(address beneficiary) external view returns (uint256[] memory) {
        return _beneficiaryPots[beneficiary];
    }

    function getPayees(uint256 potId) external view returns (address[] memory addrs, string[] memory labels) {
        address[] storage list = _payeeList[potId];
        uint256 len = list.length;
        addrs = new address[](len);
        labels = new string[](len);

        for (uint256 i = 0; i < len; ++i) {
            address payee = list[i];
            addrs[i] = payee;
            labels[i] = _payeeLabel[potId][payee];
        }
    }

    function getPayments(uint256 potId) external view returns (Payment[] memory) {
        return _payments[potId];
    }

    function getPayeeRequests(uint256 potId) external view returns (PayeeRequest[] memory) {
        return _payeeRequests[potId];
    }

    function pendingRequestCount(uint256 potId) external view returns (uint256) {
        return _pendingRequestCount[potId];
    }

    function _requireSender(Pot storage pot) internal view {
        if (pot.sender != msg.sender) revert NotSender();
    }

    function _requireBeneficiary(Pot storage pot) internal view {
        if (pot.beneficiary != msg.sender) revert NotBeneficiary();
    }

    function _requireParticipant(Pot storage pot) internal view {
        if (msg.sender != pot.sender && msg.sender != pot.beneficiary) revert NotParticipant();
    }

    function _requireOpen(Pot storage pot) internal view {
        if (pot.closed) revert PotClosed();
    }

    function _validatePayee(address sender, address beneficiary, address payee) internal view {
        if (payee == address(0)) revert ZeroAddress();
        if (payee == sender) revert SenderCannotBePayee();
        if (payee == beneficiary) revert BeneficiaryCannotBePayee();
        if (payee == address(this)) revert ContractCannotBePayee();
        if (payee == address(usdc)) revert ContractCannotBePayee();
    }

    function _addPayee(
        uint256 potId,
        address sender,
        address beneficiary,
        address payee,
        string calldata label
    ) internal {
        _validatePayee(sender, beneficiary, payee);
        if (_isApprovedPayee[potId][payee]) revert AlreadyApprovedPayee();

        _isApprovedPayee[potId][payee] = true;
        _payeeLabel[potId][payee] = label;
        _payeeList[potId].push(payee);

        emit PayeeAdded(potId, payee, label);
    }
}
