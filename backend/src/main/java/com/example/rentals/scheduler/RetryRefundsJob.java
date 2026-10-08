package com.example.rentals.scheduler;

import com.example.rentals.payment.Refund;
import com.example.rentals.payment.RefundRepository;
import com.example.rentals.payment.RefundService;
import com.example.rentals.payment.RefundStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RetryRefundsJob {

    private final RefundRepository refundRepository;
    private final RefundService refundService;

    @Scheduled(fixedRate = 600000)
    public void run() {
        List<Refund> failedRefunds = refundRepository.findByStatusAndAttemptCountLessThan(RefundStatus.FAILED, 5);
        if (failedRefunds.isEmpty()) return;

        log.info("RetryRefundsJob attempting to retry {} failed refunds", failedRefunds.size());
        for (Refund r : failedRefunds) {
            try {
                refundService.retryRefund(r.getId());
            } catch (Exception e) {
                log.error("Failed to retry refund id={}: {}", r.getId(), e.getMessage());
            }
        }
    }
}
